const express = require('express');
const PORT = process.env.PORT || 8080;
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const bodyParser = require("body-parser");
const session = require('express-session');
const app = express();
app.use(express.static("public"));
app.use(express.urlencoded({extended: false}));
const connection=mysql.createConnection({
  host: 'metro.proxy.rlwy.net',
  port: 19075,
  user: 'root',
  password: 'hcEhZXWlcIdLwuySwlIVXrokqCEsbEQU',
  database: 'railway'
});

const today = new Date();
today.setHours(0, 0, 0, 0);

const reminderDays = 2;

connection.query(
  `SELECT tasks.id, tasks.name, tasks.dl, kyusyu_members.email
   FROM tasks
   JOIN kyusyu_members ON tasks.member_id = kyusyu_members.id
   WHERE DATE(tasks.dl) = DATE_ADD(CONVERT_TZ(NOW(), '+00:00', '+09:00'), INTERVAL ? DAY)`,
  [reminderDays],
  (error, results) => {
    if (error) {
      console.error("Database query error:", error);
      return;
    }

    if (Array.isArray(results) && results.length > 0) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'taskmanager002@gmail.com',
          pass: 'lzbc gjul cytu kqyx'
        }
      });
      results.forEach(task => {
        const mailOptions = {
          from: 'taskmanager002@gmail.com',
          to: task.email,
          subject: `【リマインド】タスクの期限が近づいています`,
          text: `「${task.name}」の期限まであと2日です。お忘れなく！
          ${task.url}`
        };
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error(`❌ メール送信エラー (${task.email}):`, err);
          } else {
            console.log(`📩 メール送信成功 (${task.email}):`, info.response);
          }
        });
      });
    } else {
      console.log("No tasks found for reminder.");
    }
  }
);

const cron = require('node-cron');
cron.schedule('0 9 * * *', async () => {
  console.log("⏰ リマインドメール送信開始（日本時間 9:00 AM）");
  try {
    await sendReminderEmails();
    console.log("✅ リマインドメール送信完了");
  } catch (error) {
    console.error("❌ リマインドメール送信失敗:", error);
  }
}, {
  timezone: "Asia/Tokyo"
});

console.log("📌 メールリマインダーが設定されました");

connection.connect((err) => {
  if (err) {
      console.error("MySQL接続エラー: " + err.message);
      return;
  }
  console.log("MySQLに接続しました");
});

const MySQLStore = require('express-mysql-session')(session);
const options = {
  host: 'metro.proxy.rlwy.net',
  uuser: 'root',
  password: 'hcEhZXWlcIdLwuySwlIVXrokqCEsbEQU',
  database: 'railway'
};

const sessionStore = new MySQLStore(options);

app.use(session({
  key: 'session_cookie_name',
  secret: 'your_secret_key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}));

app.get('/', (req, res) => {
  res.render('top.ejs');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get('/kyusyu', (req, res) => {
  connection.query(
    'SELECT * FROM kyusyu_members',
    (error, results) => {
      res.render('kyusyu.ejs', {kyusyu_members: results});
    }
  );
});

app.get('/new_member', (req, res) => {
  res.render('new_member.ejs');
});

app.get('/new_task/:id', (req, res) => {
  const id = req.params.id;
  connection.query(
    'SELECT * FROM kyusyu_members WHERE id = ?',[id],
    (error, results) => {
      res.render('new_task.ejs', { kyusyu_member: results[0] });
    }
  );
});

app.get('/new_task_all/kyusyu', (req, res) => {
  connection.query(
    'SELECT * FROM kyusyu_members',
    (error, results) => {
      res.render('new_task_all.ejs', { kyusyu_members: results });
    }
  );
});

app.post('/create_kyusyu_member', (req, res) => {
  connection.query(
    'INSERT INTO kyusyu_members (name,email) VALUES (?,?)',
    [req.body.kyusyu_memberName,req.body.kyusyu_memberEmail],
    (error, results) => {
      res.redirect('/kyusyu');
    }
  );
});

app.post('/create_task/:id', (req, res) => {
  const taskName = req.body.taskName || '未設定';  // 空なら '未設定'
  const taskAbout = req.body.taskAbout || null;    // 空なら NULL（DBが許容する場合）
  const taskUrl = req.body.taskUrl || null;        // 空なら NULL
  const taskDl = req.body.taskDl || null;  
  if (!taskName) {
    return res.send('<p style="color:red;">タスク名は必須です</p><a href="/new_task/kyusyu">戻る</a>');
  }
  connection.query(
    'INSERT INTO tasks (name,about,url,dl,member_id) VALUES (?,?,?,?,?)',
    [taskName, taskAbout || null, taskUrl || null, taskDl || null, req.params.id],
  );
  const id = req.params.id;
  console.log(id); 
  connection.query(
    'SELECT * FROM kyusyu_members WHERE id = ?',[id],
    (error, results) => {
      res.redirect(`/profile_kyusyu_member/${id}`);
    }
  );
});

app.post('/create_task_all/kyusyu', (req, res) => {
  connection.query('SELECT id FROM kyusyu_members', (error, results) => {
    if (error) {
      console.error('Database error:', error);
      return res.status(500).send('Database error');
    }
    results.forEach(member => {
      connection.query(
        'INSERT INTO tasks (name, about, url, dl, member_id) VALUES (?, ?, ?, ?, ?)',
        [
          req.body.taskName,
          req.body.taskAbout,
          req.body.taskUrl,
          req.body.taskDl,
          member.id
        ],
        (error) => {
          if (error) {
            console.error('Error inserting task:', error);
            return res.status(500).send('Error inserting task');
          }
        }
      );
    });
      res.redirect(`/kyusyu`);
    }
  );
});

app.post('/delete_kyusyu_member/:id', (req, res) => {
  connection.query(
    'DELETE FROM kyusyu_members WHERE id = ?',
    [req.params.id],
    (error, results) => {
      res.redirect('/kyusyu');
    }
  );
});

app.post('/delete_task/:id', (req, res) => {
  const taskId = req.params.id; 
  connection.query(
    'SELECT member_id FROM tasks WHERE id = ?',
    [taskId],
    (error, results) => {
      const memberId = results[0].member_id;
      connection.query(
        'DELETE FROM tasks WHERE id = ?',
        [taskId],
        (deleteError) => {
          console.log(`Task ${taskId} deleted successfully`);
          res.redirect(`/profile_kyusyu_member/${memberId}`);
        }
      );
    }
  );
});

app.get('/edit/:id', (req, res) => {
  const id = req.params.id;
  connection.query(
    'SELECT * FROM kyusyu_members WHERE id = ?',[id],
    (error, memberResults) => {
    connection.query(
      'SELECT * FROM tasks WHERE id = ?',[id],
      (error, taskResults) => {
        res.render('edit_task.ejs', {kyusyu_member: memberResults[0], task: taskResults[0] });
    });
  });
});

app.post('/update_task/:id', (req, res) => {
  const taskId = req.params.id;
  const { taskName, taskAbout, taskUrl, taskDl } = req.body;
  console.log('Received Data:', req.body);
  connection.query(
    'SELECT member_id FROM tasks WHERE id = ?',
    [taskId],
    (error, results) => {
      if (error) {
        console.error('Error fetching member_id:', error);
        return res.status(500).send('Database error');
      } 
      if (results.length === 0) {
        console.log('No task found with id:', taskId);
        return res.status(404).send('Task not found');
      }
      const memberId = results[0].member_id;
      connection.query(
        'UPDATE tasks SET name = ?, about = ?, url = ?, dl = ? WHERE id = ?',
        [taskName, taskAbout, taskUrl, taskDl, taskId],
        (updateError) => {
          if (updateError) {
            console.error('Error updating task:', updateError);
            return res.status(500).send('Error updating task');
          }
          console.log(`Task ${taskId} updated successfully`);
          res.redirect(`/profile_kyusyu_member/${memberId}`);
        }
      );
    }
  );
});


app.get('/about/:id', (req, res) => {
  const id = req.params.id;
  connection.query(
    'SELECT * FROM kyusyu_members WHERE id = ?',[id],
    (error, memberResults) => {
    connection.query(
      'SELECT * FROM tasks WHERE id = ?',[id],
      (error, taskResults) => {
        res.render('about_task.ejs', {kyusyu_member: memberResults[0], task: taskResults[0] });
    });
  });
});

app.get('/profile_kyusyu_member/:id', (req, res) => {
  const id = req.params.id;
  connection.query(
    `SELECT 
        tasks.id AS task_id, tasks.name AS task_name, tasks.dl AS task_dl, tasks.dl AS task_dl, tasks.member_id AS task_member_id,
        kyusyu_members.id AS member_id, kyusyu_members.name AS member_name, kyusyu_members.email AS member_email
     FROM kyusyu_members
     LEFT JOIN tasks ON tasks.member_id = kyusyu_members.id
     WHERE kyusyu_members.id = ?`,
    [id],
    (error, results) => {
      const kyusyu_member = {
        id: results[0].member_id,
        name: results[0].member_name,
        email: results[0].member_email
      };
      const tasks = results[0].member_id ? 
          results.map(row => ({
              id: row.task_id,
              name: row.task_name,
              dl: row.task_dl,
              member_id: row.task_member_id
          })).filter(task => task.id !== null) 
          : [];
      res.render('profile.ejs', { kyusyu_member, tasks });
    }
  );
});

app.listen(3000);
