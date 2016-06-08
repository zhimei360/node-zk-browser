/**
/*
 *  Licensed to the Apache Software Foundation (ASF) under one
 *  or more contributor license agreements.  See the NOTICE file
 *  distributed with this work for additional information
 *  regarding copyright ownership.  The ASF licenses this file
 *  to you under the Apache License, Version 2.0 (the
 *  "License"); you may not use this file except in compliance
 *  with the Licens"dependencies": {
    "express": "3.4.4",
    "jade": "*"
  }e.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 *
 * node-zk-browser
 * author :dennis (killme2008@gmail.com)
 *
 */

var express = require('express');
var auth = require('basic-auth');
require('express-namespace');
var path=require('path');
var fs=require('fs');
var util=require('util');
var ZkClient=require('./zk.js').ZkClient;

var port=3000;
var host = process.env.ZK_HOST || 'localhost:2181'
var zkclient = new ZkClient(host);
var users = JSON.parse(fs.readFileSync(path.join(__dirname,'user.json'), 'utf8'));
var app = express();

process.on('uncaughtException', function (err) {
  console.error('Caught exception: ' + err);
});

app.use(function(req, res, next){

// res.status(401).send('no login');

  var credentials = auth(req)

  // console.log(users);
  // 用户和密码保存在 user.json 文件中
  if (!credentials || credentials.name !== 'admin' || credentials.pass !== users.admin) {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="zookeeper"')
    res.end('Access denied')
  } else {
    next();
  }
});

// Configuration
app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.cookieParser());
    app.use(express.session({ secret: "node zk browser" }));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', function(req, res){
    res.redirect("/node-zk");
});

app.get('/login', function(req, res){
    res.status(401).send('no login');
});

app.namespace("/node-zk", function(){

    //index
    app.get('/', function(req, res){
        res.render('zkMain', { });
    });

    app.get('/memcache', function(req, res){
        res.render('memcache', { });
    });

    //create view
    app.get("/zkDetail",function(req,res){
        res.render("zkDetail",{layout:false,user: req.session.user});
    });


    //display tree
    app.get('/tree', function(req, res){
        var path=req.query.path || "/";
        res.render('tree', {layout:false,'path':path  });
    });

    //login
    app.post("/login",function(req,res){
        var user=req.body.user;
        if(users[user.name]==user.password){
            req.session.user=user.name;
            req.session.cookie.maxAge= 60*60*1000;
        }
        res.redirect(req.header('Referer'));
    });

    //delete
    app.post("/delete",function(req,res){
        if(req.session.user){
            var path=req.body.path;
            var version=Number(req.body.version);
            zkclient.zk.a_delete_(path,version,function(rc,err){
                if(rc!=0)
                    res.send(err);
                else
                    res.send("Delete ok");
            });
        }else{
            res.send("请登录");
        }
    });

    //create view
    app.get("/create",function(req,res){
        res.render("create",{layout:false,user: req.session.user});
    });

    //create
    app.post("/create",function(req,res){
        if(req.session.user){
            var path=req.body.path;
            var data=req.body.data;
            var flag=Number(req.body.flag);
            zkclient.zk.a_create(path,data,flag,function(rc,err,path){
                if(rc!=0)
                    res.send(err);
                else
                    res.send("创建成功，请刷新页面！");
            });
        }else{
            res.send("请登录");
        }
    });

    //edit
//    app.post("/edit",function(req,res){
//        if(req.session.user){
//            var path=req.body.path;
//            var new_data=req.body.new_data;
//            var version=Number(req.body.version);
//            zkclient.zk.a_set(path,new_data,version,function(rc,err,stat){
//                if(rc!=0){
//                    res.send(err);
//                }else
//                    res.send("set ok");
//            });
//        }else{
//            res.send("Please logon");
//        }
//    });

    app.post("/edit",function(req,res){
        if(req.session.user){
            var path=req.body.path;
            var new_data=req.body.new_data;
            if(new_data.length==0){
            	return;
            }
            var version=Number(req.body.version);
            zkclient.zk.a_set(path,new_data,version,function(rc,err,stat){
                if(rc!=0){
                    res.send(err);
                }else
                    res.send("操作成功");
            });
        }else{
            res.send("请登录");
        }
    });

    //query data
    app.get("/get",function(req,res){
        var path=req.query.path || "/";
        zkclient.zk.a_get(path,null,function(rc,err,stat,data){
            if(rc!=0){
                res.send(err);
            }else{
            	var buff = new Buffer(data);
            	var result = buff.toString('utf8');
                res.render("data",{ layout: false, 'stat':stat,'data':result,'path':path,'user': req.session.user});
            }
        });
    });

    //query children
    app.get('/children',function(req,res){
        var parenPath=req.query.path || '/';

    	 zkclient.zk.a_get("/conf",null,function(rc,err,stat,data){
         	var buff = new Buffer(data);
         	var nameMapper = buff.toString('utf8');
         	var nameMapperObj = JSON.parse(nameMapper);
         	var detailsNameMapperObj=new Object();
         	try{
         		detailsNameMapperObj = nameMapperObj[0]['details'];
         	}catch(e){
         	}

         	getChildren(parenPath,detailsNameMapperObj,req,res);
         });

//        zkclient.zk.a_get_children(parenPath,null,function(rc,error,children){
//            res.header("Content-Type","application/json");
//            var result=[];
//            if(rc==0){
//                children.forEach(function(child){
//                	if(child == 'zookeeper'){
//                		return;
//                	}
//                    realPath=path.join(parenPath,child);
//                    result.unshift({
//                        attributes:{"path":realPath,"rel":"chv"},
//                        data:{
//                            title : child,icon:"ou.png", attributes: { "href" : ("/node-zk/get?path="+realPath) }
//                        },
//                        state:"closed"
//                    });
//                });
//            }
//            res.send(result);
//        });
    });

    function getChildren(parenPath,nameMapperObj,req,res){
    	zkclient.zk.a_get_children(parenPath,null,function(rc,error,children){
            res.header("Content-Type","application/json");
            var result=[];
            if(rc==0){
                children.forEach(function(child){
                	if(child == 'zookeeper'){
                		return;
                	}
                	var nodeName = child;

                	if(nameMapperObj && parenPath == '/conf' || (parenPath == '/' && child == 'conf')){
                		nodeName = nameMapperObj[nodeName];
                		if(!nodeName || nodeName=='undefined'){
                			nodeName = '未命名';
                		}
                	}
                    realPath=path.join(parenPath,child);
                    result.unshift({
                        attributes:{"path":realPath,"rel":"chv"},
                        data:{
                            title : nodeName,icon:"ou.png", attributes: { "href" : ("/node-zk/get?path="+realPath) }
                        },
                        state:"closed"
                    });
                });
            }
            res.send(result);
        });
    }
});

app.listen(port);
console.log("Express server listening on port %d", port);
