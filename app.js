require ('mootools');
var Server = require('./server/server');
    
var gameport = process.env.PORT || 4004;
var io       = require('socket.io');
var express  = require('express');
var verbose  = false;
var http     = require('http');
var app      = express();
var server   = http.createServer(app);

/* Express server set up. */

//The express server handles passing our content to the browser,
//As well as routing users where they need to go. This example is bare bones
//and will serve any file the user requests from the root of your web server (where you launch the script from)
//so keep this in mind - this is not a production script but a development teaching tool.

//Tell the server to listen for incoming connections
server.listen(gameport)

//Log something so we know that it succeeded.
console.log('\t :: Express :: Listening on port ' + gameport );

//By default, we forward the / path to index.html automatically.
app.get( '/', function( req, res )
{
	console.log('trying to load %s', __dirname + '/index.html');
        res.sendfile( '/index.html' , { root:__dirname });
});

//This handler will listen for requests on /*, any file from the root of our server.
//See expressjs documentation for more info on routing.

app.get( '/*' , function( req, res, next ) 
{
	//This is the current file they have requested
        var file = req.params[0];

        //For debugging, we can track what files are requested.
        if(verbose) 
	{
		console.log('\t :: Express :: file requested : ' + file);
	}

        //Send the requesting client the file.
        res.sendfile( __dirname + '/' + file );
}); //app.get *

/* Socket.IO server set up. */

//Express and socket.io can work together to serve the socket.io client files for you.
//This way, when the client requests '/socket.io/' files, socket.io determines what the client needs.
        
//Create a socket.io instance using our express server
var sio = io.listen(server);

//Configure the socket.io connection settings.
//See http://socket.io/
sio.configure(function ()
{
	sio.set('log level', 0);

        sio.set('authorization', function (handshakeData, callback) 
	{
        	callback(null, true); // error first callback style
        });
});

//Enter the game server code. The game server handles
//client connections looking for a game, creating games,
//leaving games, joining games and ending games when they leave.
global.window = global.document = global;

var frame_time = 60/1000; // run the local game at 16ms/ 60hz
if ('undefined' != typeof(global)) 
{
	frame_time = 45; //on server we run at 45ms, 22hz
}

( function () 
{
    	var lastTime = 0;
    	var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

    	for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) 
	{
        	window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
        	window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
    	}

    	if ( !window.requestAnimationFrame ) 
	{
        	window.requestAnimationFrame = function ( callback, element ) 
		{
            		var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
            		var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
            		lastTime = currTime + timeToCall;
            		return id;
        	};
    	}
    	
	if ( !window.cancelAnimationFrame ) 
	{
        	window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
    	}
}());

SERVER = new Server();

//Socket.io will call this function when a client connects,
//So we can send that client looking for a game to play,
//as well as give that client a unique ID to use so we can
//maintain the list if players.
sio.sockets.on('connection', function (client) 
{
        var serverCore = SERVER.findGame(client);

	var serverClientIDArray = new Array();
	serverClientIDArray.push(client.userid);

	for (var i = 0; i < serverCore.serverClientArray.length; i++)
	{
		serverClientIDArray.push(serverCore.serverClientArray[i].userid);	
	}
	for (var i = 0; i < serverClientIDArray.length; i++)
	{
		console.log('id:' + serverClientIDArray[i]);
	}
	

        client.emit('onconnected', serverClientIDArray );

        console.log('\t socket.io:: player ' + client.userid + ' connected');
        
        client.on('message', function(m) 
	{
        	SERVER.onMessage(client, m);
        }); 

        client.on('disconnect', function () 
	{
            	console.log('\t socket.io:: client id disconnected: ' + client.userid + ' from serverGameID: ' + client.serverCore.id);
        });
}); 
