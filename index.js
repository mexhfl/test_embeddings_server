const Koa = require('koa');
const Router = require('koa-router');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
let OpenAI = require('openai');
const knex = require('knex');
const cosineSimilarity = require('cosine-similarity');
const configInfo = require('./config')

const app = new Koa();
const router = new Router();

const openai = new OpenAI({
    apiKey: configInfo.OPENAI_API_KEY
});


app.use(cors({
    origin: configInfo.ALLOW_ORIGIN, // 允许来自所有域名请求
    credentials: true,
    allowMethods: ['GET', 'POST', 'DELETE'], // 设置所允许的HTTP请求方法
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

const db = knex({
    client: 'pg',
    connection: configInfo.DB_CONFIG
});

async function fetchEmbeddings(question) {
    let embedding = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: question,
    });
    return embedding.data[0]
}
function generateUUID(length) {
    let uuid = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
        uuid += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return uuid;
}
async function addEmbedding(question, embedding) {

    await db('embeddings').insert({
        id: generateUUID(16),
        question,
        embedding: embedding
    });
}

async function findMostSimilarEmbeddings(queryEmbedding, threshold = 0.8) {
    const rows = await db.select('*').from('embeddings');
    const similarities = [];

    for (const row of rows) {
        const similarity = cosineSimilarity(queryEmbedding, row.embedding.embedding);
        if (similarity >= threshold) {
            similarities.push({
                question: row.question,
                similarity
            });
        }
    }

    // 按相似度从高到低排序
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities;
}

router.post('/add', async (ctx) => {
    const { question } = ctx.request.body;
    console.log("question>>>",question)
    const embedding = await fetchEmbeddings(question)
    console.log(embedding);
    await addEmbedding(question, embedding);
    ctx.body = { message: 'Embedding added successfully' };
});

router.post('/find-similar', async (ctx) => {
    const { question } = ctx.request.body;
    queryEmbedding = await fetchEmbeddings(question);
    const mostSimilar = await findMostSimilarEmbeddings(queryEmbedding.embedding);
    ctx.body = mostSimilar;
});
router.post('/find-questions', async (ctx) => {
    const rows = await db.select('question').from('embeddings')

    ctx.body = rows;
});

app.use(bodyParser());
app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
