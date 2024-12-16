const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 配置body-parser中间件，用于解析JSON和urlencoded格式的数据
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 提供public目录中的静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 定义根路径的路由，返回index.html文件
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 连接到SQLite数据库，这里创建一个名为game.db的数据库文件（如果不存在的话）
const db = new sqlite3.Database('game.db');

// 创建用户表（如果不存在），用于存储用户名、密码等信息，同时可以扩展字段用于存储游戏分数等其他相关信息
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        game_time TEXT NOT NULL, 
        score INTEGER NOT NULL,
        FOREIGN KEY(username) REFERENCES users(username)
    )`);
});

// 注册接口
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username ||!password) {
        return res.status(400).send('用户名和密码不能为空');
    }
    const sql = `INSERT INTO users (username, password) VALUES (?,?)`;
    db.run(sql, [username, password], function (err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).send('用户名已存在');
            }
            return res.status(500).send('注册失败');
        }
        res.send('注册成功');
    });
});
// 登录接口
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('用户名和密码不能为空');
    }
    const sql = `SELECT * FROM users WHERE username = ? AND password = ?`;
    db.get(sql, [username, password], (err, row) => {
        if (err) {
            return res.status(500).send('登录失败');
        }
        if (!row) {
            return res.status(400).send('用户名或密码错误');
        }
        res.json({message: '登录成功',username:row.username});
    });
});

//更新玩家的游戏分数和时间
app.post('/updateScore', (req, res) => {
    const { username, game_time, score } = req.body;
    if (!username || score === undefined || !game_time) {
        return res.status(400).send('用户名、分数和开始时间不能为空');
    }
    const sql = `INSERT INTO game_records (username, game_time, score) VALUES (?, ?, ?)`;
    db.run(sql, [username, game_time, score], function (err) {
        if (err) {
            return res.status(500).send('更新分数失败');
        }
        res.send('分数更新成功');
    });
});

//获取玩家的个人信息和游戏得分历史记录
app.get('/getUserInfo', (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).send('用户名不能为空');
    }

    const userInfoSql = `SELECT username FROM users WHERE username = ?`;
    const gameRecordsSql = `SELECT game_time, score FROM game_records WHERE username = ? ORDER BY game_time DESC`;

    db.get(userInfoSql, [username], (err, userInfo) => {
        if (err) {
            return res.status(500).send('获取用户信息失败');
        }
        if (!userInfo) {
            return res.status(404).send('用户不存在');
        }

        db.all(gameRecordsSql, [username], (err, gameRecords) => {
            if (err) {
                return res.status(500).send('获取游戏记录失败');
            }
            res.json({ userInfo, gameRecords });
        });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});