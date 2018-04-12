var express = require('express');
const bodyParser = require('body-parser');
var admin = require('firebase-admin');
var cron = require('cron');
var request = require("request");
var app = express();
var cluster = 'cattily94'


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


var admin = require('firebase-admin');
var serviceAccount = require("./fcm-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cts-srm-app.firebaseio.com"
});

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

var ADMIN_TOKEN;
request({
  url: "https://auth."+cluster+".hasura-app.io/v1/login",
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "provider": "username",
    "data": {
        "username": process.env.ADMIN_USERNAME,
        "password": process.env.ADMIN_PASSWORD
    }
})
}, function(err, resp, body) {
   if ((resp.statusCode === 200 || resp.statusCode === 201)) {
     console.log('body: '+body);
     ADMIN_TOKEN = JSON.parse(body).auth_token;
     console.log("ADMIN_TOKEN set "+ADMIN_TOKEN);
   }
   else{
     console.log('err: '+err);
     console.log('body: '+body);
   }
 });
// remove comment to keep server alive

var job = new cron.CronJob('* * * * *', function() {
	request("https://auth."+cluster+".hasura-app.io/ui", function(error, response, body) {
  //console.log(body);
});
    console.log('Function executed!');
}, null, true);


//your routes here

app.post('/user/delete',function (req,res) {
  request({
              url: "https://auth."+cluster+".hasura-app.io/v1/admin/delete-user",
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': "Bearer "+ADMIN_TOKEN,
                'X-Hasura-User-Id': 4,
                'X-Hasura-Role': "admin"
              },
              body: JSON.stringify({
                "hasura_id": req.body.userid
              })
        }, function(err, resp, body) {
           if (res && (resp.statusCode === 200 || resp.statusCode === 201)) {
             //console.log('body: '+body);
             request({
                         url: "https://data."+cluster+".hasura-app.io/v1/query",
                         method: 'POST',
                         headers: {
                           'Content-Type': 'application/json',
                           'Authorization': "Bearer "+ADMIN_TOKEN,
                           'X-Hasura-User-Id': 4,
                           'X-Hasura-Role': "admin"
                         },
                         body: JSON.stringify({
                              "type": "delete",
                              "args": {
                                  "table": "users",
                                  "where": {
                                      "id": {
                                          "$eq": req.body.userid
                                      }
                                  }
                              }
                          })
                   }, function(err, resp, body) {
                      if (res && (resp.statusCode === 200 || resp.statusCode === 201)) {
                        //console.log('body: '+body);
                        res.status(200).send(body);
                      }
                      else{
                        res.status(400).send(body);
                        console.log('err: '+err);
                        console.log('body: '+body);
                      }
               });
           }
           else{
             res.status(400).send(body);
             console.log('err: '+err);
             console.log('body: '+body);
           }
    });
})

app.post('/updates/newupdate',function(req,res){

  var data ={
    "type": "insert",
    "args": {
        "table": "updates",
        "objects": [
            {
                "mentor":req.body.userid,
                "update":req.body.update
            }
        ],
        "returning": [
            "update_id"
        ]
    }
  };

  var options = {
    url: "https://data."+cluster+".hasura-app.io/v1/query",
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+req.body.token,
      'X-Hasura-Role': "cts"
    },
    body: JSON.stringify(data)
  };
  request(options, function(err, resp, body) {
     if (res && (resp.statusCode === 200 || resp.statusCode === 201)) {
       console.log('body: '+body);
       res.status(200).send(body);
       var mentor = req.body.userid;
       var update = req.body.update;
       fcmbroadcast_update(mentor,update);
     }
     else{
       res.status(400).send(body);
       console.log('err: '+err);
       console.log('body: '+body);
     }
   });
})
app.post('/task/newtask',function(req,res){

  var data ={
    "type": "insert",
    "args": {
        "table": "tasks",
        "objects": [
            {
                "mentor":req.body.userid,
                "task":req.body.task,
                "deadline":req.body.deadline,
                "college":req.body.college
            }
        ],
        "returning": [
            "task_id"
        ]
    }
  };

  var options = {
    url: "https://data."+cluster+".hasura-app.io/v1/query",
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+req.body.token,
      'X-Hasura-Role': 'cts'
    },
    body: JSON.stringify(data)
  };
  request(options, function(err, resp, body) {
     if (res && (resp.statusCode === 200 || resp.statusCode === 201)) {
       console.log('body: '+body);
       res.status(200).send(body);
       var deadline = req.body.deadline;
       var college = req.body.college;
       var task = req.body.task;
       fcmbroadcast_task(deadline,college,task);
     }
     else{
       res.status(400).send(body);
       console.log('err: '+err);
       console.log('body: '+body);
     }
   });
})
app.post('/mentor/addmentor',function(req,res){
  if(req.body.mentor_secret === process.env.MENTOR_KEY){
      request({
                  url: "https://auth."+cluster+".hasura-app.io/v1/admin/user/add-role",
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': "Bearer "+ADMIN_TOKEN,
                    'X-Hasura-User-Id': 4,
                    'X-Hasura-Role': "admin"
                  },
                  body: JSON.stringify({
                    "hasura_id": req.body.userid,
                    "role": "cts"
                  })
            }, function(err, resp, body) {
               if (res && (resp.statusCode === 200 || resp.statusCode === 201)) {
                 //console.log('body: '+body);
                 res.status(200).send(body);
               }
               else{
                 res.status(400).send(body);
                 console.log('err: '+err);
                 console.log('body: '+body);
               }
        });
  }
else{
  res.status(401).send("You are not authorised")
}
});

app.post('/chat/newmessage',function(req,res){
  console.log("received new msg request");
  var data ={
    "type": "insert",
    "args": {
        "table": "chats",
        "objects": [
            {
                "sender": req.body.userid,
                "message": req.body.message
            }
        ],
        "returning": [
            "msg_id",
            "time"
        ]
    }
  };

  var options = {
    url: "https://data."+cluster+".hasura-app.io/v1/query",
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+req.body.token
    },
    body: JSON.stringify(data)
  };
  request(options, function(err, resp, body) {
     if (res && (resp.statusCode === 200 || resp.statusCode === 201)) {
       //res.send(200);
       console.log('body: '+body);
       res.status(200).send(body);
       var msg = req.body.message;
       var name = req.body.name;
       fcmbroadcast(msg,name,JSON.parse(resp.body).returning[0].time);
     }
     else{
       console.log('err: '+err);
       console.log('body: '+body);
     }
   });
  // save msg to db
  // fcm broadcast
});
function fcmbroadcast_task(deadline,college,task){
    college = college.replaceAll(" ","_");
    college = college.replaceAll("'","");
    var topic = 'task_'+college;
   var message = {
   data: {
     deadline: deadline,
     task: task
   },
   topic: topic
  };
  admin.messaging().send(message)
   .then((response) => {
     console.log('Successfully sent message:', response);
   })
   .catch((error) => {
     console.log('Error sending message:', error);
   });
}
function fcmbroadcast(message,name,time){
	 var topic = 'chatroom';
	var message = {
  data: {
  	message: message,
    name: name,
    time: time
  },
  topic: topic
};
admin.messaging().send(message)
  .then((response) => {
    console.log('Successfully sent message:', response);
  })
  .catch((error) => {
    console.log('Error sending message:', error);
  });
}
function fcmbroadcast_update(mentor,update){
	var topic = 'update';
	var message = {
  data: {
  	mentor: mentor,
    update: update
  },
  topic: topic
};
admin.messaging().send(message)
  .then((response) => {
    console.log('Successfully sent message:', response);
  })
  .catch((error) => {
    console.log('Error sending message:', error);
  });
}
app.listen(8080, function () {
  console.log('Example app listening on port 8080!');
});
