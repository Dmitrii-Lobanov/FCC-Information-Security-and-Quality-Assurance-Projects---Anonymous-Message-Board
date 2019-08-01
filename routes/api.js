'use strict';

const expect = require('chai').expect;
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;

module.exports = function (app) {
  
  app.route('/api/threads/:board')
    .post((req, res) =>{
      if(req.body.text.length == 0){
        return res.json({Error: 'Please include some thread text and try again'});
      } else if(req.body.delete_password.length == 0){
        return res.json({Error: 'Please include a password for deleting this thread'});
      };
    
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log('Error connecting to database');
      database.db('chiclet').collection(req.params.board).insertOne({
        threadName: req.body.text,
        deletePassword: req.body.delete_password,
        created_on: new Date(),
        bumpedOn: new Date(),
        reported: false,
        replies: [],
        replyCount: 0
      }, (err, data) => {
        if(err) return console.log("Error with findOneAndUpdate when posting thread", err);
        database.close();
        res.redirect('/chiclet' + encodeURIComponent(req.body.board));
      });
    });
  })
  
  .get((req, res) =>{
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log("Error connecting to database");
      database.db('chiclet').collection(req.params.board).find()
        .sort({bumpedOn: -1})
        .limit(10)
        .project({
          deletePassword: 0,
          reported: 0,
          replies: {$slice: 3}
        })
        .toArray((err, data) =>{
        if(err) return console.log('Error with find()');
        database.close();
        res.json(data);
      });
    });
  })
  
  .delete((req, res) =>{
    if(req.body.thread_id.length == 0){
      return res.json({Error: 'Please include the ID of the thread to delete'});
    } else if(ObjectId.isValid(req.body.thread_id) == false){
      return res.json({Error: 'The submitted thread ID ' + req.body.thread_id + ' is not in the correct format'});
    } else if(req.body.delete_password.length == 0){
      return res.json({Error: 'Please include the password to delete this thread'})
    };
    
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log('Error connecting to database');
      database.db('chiclet').collection(req.params.board).deleteOne(
        {
          $and: [
            {_id: ObjectId(req.body.thread_id)},
            {deletePassword: req.body.delete_password}
          ]
        },
        (err, data) =>{
          if(err) return console.log('Error finding thread to delete');
          database.close();
          if(data.deletedCount == 1){
            return res.json('Thread ' + req.body.thread_id + ' was successfully deleted');
          } else if(data.deletedCount == 0){
            return res.json('Failed to delete thread ' + req.body.thread_id);
          } else{
            return res.json('Something unexprected happened while attempting to delete the thread');
          };
        });
    });
  })
  
  .put((req, res) =>{
    if(req.body.thread_id.length == 0){
      return res.json({Error: 'Please include the ID of the thread that you wish to report'});
    } else if(ObjectId.isValid(req.body.thread_id) == false){
      return res.json({Error: 'The submitted thread ID ' + req.body.thread_id + ' is not in the correct format'});
    };
    
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log('Error connecting to the database');
      database.db('chiclet').collection(req.params.board).findOneAndUpdate(
        {_id: ObjectId(req.body.thread_id)},
        {$set: {reported: true}},
        {returnOriginal: false},
        (err, data) =>{
          if(err) return console.log('Error reporting thread using');
          database.close();
          if(data.value == undefined){
            return res.json('Failed to report thread ' + req.body.thread_id + ' in board ' + req.params.board);
          } else if(data.value.reported == true){
            return res.json('Thread ' + req.body.thread_id + ' in board ' + req.params.board + ' has been successfully reported');
          } else{
            return res.json('Something unexpected has happened while attempting to report thread ' + req.body.thread_id)
          };
        });
    });
  });
  
  app.route('/api/replies/:board')
    .post((req,  res) =>{
    if(req.body.thread_id.length == 0){
      return res.json({Error: 'Pleast include the ID of the thread to which you wish to add a reply'});
    } else if(ObjectId.isValid(req.body.thread_id) == false){
      return res.json({Error: 'The submitted thread ' + req.body.thread_id + ' is not in the correct form'});
    } else if(req.body.text.length == 0){
      return res.json({Error: 'Please include some text in your reply'});
    } else if(req.body.delete_password.length == 0){
      return res.json({Error: 'Please include password to delete this reply'});
    };
    
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log('Error connecting to database');
      database.db('chiclet').collection(req.params.board).findOneAndUpdate(
        {_id: ObjectId(req.body.thread_id)},
        {
          $set: {bumpedOn: new Date()},
          $inc: {replyCount: 1},
          $push: {
            replies: {
              $each: [
                {
                  _id: new ObjectId(),
                  reply: req.body.text,
                  deletePassword: req.body.delete_password,
                  createdOn: new Date(),
                  reported: false
                }
              ],
              $sort: {createdOn: -1}
            }
          }
        },
        {
          returnOriginal: false
        },
        (err, data) =>{
          if(err) return console.log('Error with findOneAndUpdate');
          database.close();
          res.json(data.value);
        });
    });
  })
  
  .get((req, res) =>{
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log('Error connecting to database');
      database.db('chiclet').collection(req.params.board).find({_id: ObjectId(req.query.thread_id)})
        .project({
        deletePassword: 0,
        reported: 0,
        "replies.deletePassword": 0,
        "replies.reported": 0
      })
      .toArray((err, data) =>{
        if(err) return console.log('Error finding findOne');
        database.close();
        data[0].replies.reverse()
        res.json(data[0]);
      });
    });
  })
  
  .delete((req, res) =>{
    if(req.body.thread_id.length == 0){
      return res.json({Error: 'Please include the ID of the thread containing the reply you wish to delete'});
    } else if(ObjectId.isValid(req.body.thread_id) == false){
      return res.json({Error: 'The submitted thread ' + req.body.thread_id + ' is not in the correct form'});
    } else if(req.body.reply_id.length == 0){
      return res.json({Error: 'Please include the ID of the reply you wish to delete'});
    } else if(ObjectId.isValid(req.body.reply_id) == false){
      return res.json({Error: 'The submitted reply ID ' + req.body.reply_id + ' is not in the correct format'});
    } else if(req.body.delete_password.length == 0){
      return res.json({Error: 'Please include the password to delete this reply'});
    };
    
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log('Error connecting to database');
      database.db('chiclet').collection(req.params.board).findOneAndUpdate(
        {
          _id: ObjectId(req.body.thread_id),
          "replies._id": ObjectId(req.body.reply_id),
          "replies.deletePassword": req.body.delete_password
        },
        {
          $set: {"replies.$.reply": "[This reply has been deleted]"}
        },
        {
          returnOriginal: false
        },
        (err, data) =>{
          if(err) return console.log('Error trying to delete reply', err);
          database.close();
          if(data.lastErrorObject.updatedExisting == true){
            return res.json('Reply ' + req.body.reply_id + ' was successfully deleted');
          } else if(data.lastErrorObject.updatedExisting == false){
            return res.json('Reply ' + req.body.reply_id + ' was not deleted');
          } else{
            return res.json('Something unexpected has happened while trying to delete the reply with ID ' + req.body.reply_id);
          };
        });
    });
  })
  
  .put((req, res) =>{
    if(req.body.thread_id.length == 0){
      return res.json({Error: 'Please include the ID of the threadcontaining the reply you wish to report'});
    } else if(ObjectId.isValid(req.body.thread_id) == false){
      return res.json({Error: 'The submitted thread ID' + req.body.thread_id + ' is not in the correct format'});
    } else if(req.body.reply_id.length == 0){
      return res.json({Error: 'Please include the ID of the reply you wish to report'});
    } else if(ObjectId.isValid(req.body.reply_id) == false){
      return res.json({Error: 'The submitted reply ID ' + req.body.thread_id + ' is not in the correct format'});
    };
    
    MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
      if(err) return console.log('Error connecting to database');
      database.db('chiclet').collection(req.params.board).findOneAndUpdate(
        {
          _id: ObjectId(req.body.thread_id),
          "replies._id": ObjectId(req.body.reply_id)
        },
        {
          $set: {"replies.$.reported": true}
        },
        {
          returnOriginal: false
        },
        (err, data) =>{
          if(err) return console.log('Error reporting reply with findOneAndUpdate', err);
          database.close();
          if(data.lastErrorObject.updatedExisting == true){
            return res.json('Reply ' + req.body.reply_id + ' has been reported');
          }else if(data.lastErrorObject.updatedExisting == false){
            return res.json('We were not able to report reply ' + req.body.reply_id);
          } else{
            return res.json('Something unexpected has happened while tryong to report the reply');
          };
        });
    });
  });
  
  app.route('/api/boards')
    .get((req, res) =>{
      MongoClient.connect(process.env.MONGO_DB, {useNewUrlParser: true}, (err, database) =>{
        database.db('chiclet').listCollections().toArray((err, data) =>{
          if(err) return console.log('Error connecting to database');
          database.close();
          let boardNameArray = [];
          data.forEach(item => boardNameArray.push(item.name));
          return res.json(boardNameArray);  
        });
      });
  });
  
};
