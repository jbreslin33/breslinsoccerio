var ServerPlayer = require('./server.player');
var ServerWorld = require('./server.world');
var ServerPitch = require('./server.pitch');
var ServerClient = require('./server.client');
var ServerPoint3D = require('./server.point3d');

/* The ServerCore class */

var ServerCore = new Class(
{
initialize: function(server)
{

	this.mServer = server;
       
	//SERVER CORE UNIQUE IDENTIFIERS 
	this.UUID = require('node-uuid'),
        this.id = this.UUID()

	//WORLD STUFF
	this.serverWorld = new ServerWorld(720,480);

	// CLIENT STUFF        
	this.serverClientArray = new Array();
	
	for (var c = 0; c < this.mServer.MAX_NUMBER_OF_PLAYERS; c++)
	{
        	var serverClient = new ServerClient();
        	this.serverClientArray.push(serverClient);
		console.log('sc:' + serverClient.userid);
	}

	//PLAYER STUFF
	this.serverPlayerArray = new Array();
	
	//create serverPlayers
	for (var p = 0; p < this.mServer.MAX_NUMBER_OF_PLAYERS; p++)
	{
		var serverPlayer = new ServerPlayer(this);
		this.serverPlayerArray.push(serverPlayer); 
	}

        for (var p = 0; p < this.serverClientArray.length; p++)
        {
                this.serverPlayerArray[p].serverClient = this.serverClientArray[p];
                this.serverClientArray[p].serverPlayer = this.serverPlayerArray[p];
	}

	//for positions x,y
	for (var p = 0; p < this.serverPlayerArray.length; p++)	
	{
       		this.serverPlayerArray[p].pos.set(200,200,0);
	}

	
       // this.serverPlayerArray[0].pos = {x:20,y:20};
        //this.serverPlayerArray[1].pos = {x:500,y:200};
        //this.serverPlayerArray[2].pos = {x:400,y:200};

        //The speed at which the clients move.
        this.playerspeed = 120;

        //Set up some physics integration values
        this._pdt = 0.0001;                 //The physics update delta time
        this._pdte = new Date().getTime();  //The physics update last delta time

        //A local timer for precision on server and client
        this.local_time = 0.016;            //The local timer
        this._dt = new Date().getTime();    //The local timer delta
        this._dte = new Date().getTime();   //The local timer last frame time

        //Start a physics loop, this is separate to the rendering
        //as this happens at a fixed frequency
        this.create_physics_simulation();

        //Start a fast paced timer for measuring time easier
        this.create_timer();

        this.server_time = 0;
	this.lastStateArray = new Array();

},

/*
    Helper functions for the game code

        Here we have some common maths and game related code to make working with 2d vectors easy,
        as well as some helpers for rounding numbers to fixed point.

*/

//copies a 2d vector like object from one to another
pos: function(a) 
{ 
	return {x:a.x,y:a.y}; 
},

//Add a 2d vector with another one and return the resulting vector
v_add: function(a,b) 
{ 
	return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; 
},

//Subtract a 2d vector with another one and return the resulting vector
//For the server, we need to cancel the setTimeout that the polyfill creates
stop_update: function() 
{  
	window.cancelAnimationFrame( this.updateid );  
},

//Main update loop
update: function(t) 
{
	//Work out the delta time
    	this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;

        //Store the last frame time
    	this.lastframetime = t;

        //Update the game specifics
        this.server_update();

        //schedule the next update
    	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );

}, 

/*
    Shared between server and client.
    In this example, `item` is always of type ServerPlayer.
*/

check_collision: function( item ) 
{
	//Left wall.
    	if(item.pos.x <= item.pos_limits.x_min) 
	{
       		item.pos.x = item.pos_limits.x_min;
    	}

        //Right wall
    	if(item.pos.x >= item.pos_limits.x_max ) 
	{
       		item.pos.x = item.pos_limits.x_max;
    	}
    
        //Roof wall.
    	if(item.pos.y <= item.pos_limits.y_min) 
	{
        	item.pos.y = item.pos_limits.y_min;
    	}

        //Floor wall
    	if(item.pos.y >= item.pos_limits.y_max ) 
	{
        	item.pos.y = item.pos_limits.y_max;
    	}

        //Fixed point helps be more deterministic
    	item.pos.x = item.pos.x.fixed(4);
    	item.pos.y = item.pos.y.fixed(4);
}, 

process_input:  function( player ) 
{
	//It's possible to have recieved multiple inputs by now,
    	//so we process each one
    	var x_dir = 0;
    	var y_dir = 0;
    	var ic = player.inputs.length;
    	if(ic) 	
	{
        	for(var j = 0; j < ic; ++j) 
		{
                	//don't process ones we already have simulated locally
			if (player.inputs[j].seq <= player.last_input_seq) 
			{
				continue;
			}

            		var input = player.inputs[j].inputs;
            		var c = input.length;
            		for(var i = 0; i < c; ++i) 
			{
                		var key = input[i];
                		if(key == 'l') 
				{
                    			x_dir -= 1;
                		}
                		if(key == 'r') 
				{
                    			x_dir += 1;
                		}
                		if(key == 'd') 
				{
                    			y_dir += 1;
                		}
                		if(key == 'u') 
				{
                    			y_dir -= 1;
                		}
            		} //for all input values
        	} //for each input command
    	} //if we have inputs

        //we have a direction vector now, so apply the same physics as the client
    	var resulting_vector = this.physics_movement_vector_from_direction(x_dir,y_dir);
    	if(player.inputs.length) 
	{
        	//we can now clear the array since these have been processed
        	player.last_input_time = player.inputs[ic-1].time;
        	player.last_input_seq = player.inputs[ic-1].seq;
    	}

        //give it back
    	return resulting_vector;
},

physics_movement_vector_from_direction: function(x,y) 
{
        //Must be fixed step, at physics sync speed.
    return {
        x : (x * (this.playerspeed * 0.015)).fixed(3),
        y : (y * (this.playerspeed * 0.015)).fixed(3)
    };
}, 
/*
game_core.prototype.physics_movement_vector_from_direction = function(x,y) {

        //Must be fixed step, at physics sync speed.
    return {
        x : (x * (this.playerspeed * 0.015)).fixed(3),
        y : (y * (this.playerspeed * 0.015)).fixed(3)
    };

}; //game_core.physics_movement_vector_from_direction
*/

update_physics:  function() 
{
    	//if(this.server) 
	//{
        	this.server_update_physics();
    	//} 
}, 

/*

 Server side functions
 
    These functions below are specific to the server side only,
    and usually start with server_* to make things clearer.

*/

//Updated at 15ms , simulates the world state
server_update_physics: function() 
{
	for (var i = 0; i < this.serverPlayerArray.length; i++)
	{
    		this.serverPlayerArray[i].old_state.pos = this.pos( this.serverPlayerArray[i].pos );
    		var new_dir = this.process_input(this.serverPlayerArray[i]);
    		this.serverPlayerArray[i].pos = this.v_add( this.serverPlayerArray[i].old_state.pos, new_dir );
	}

	for (var i = 0; i < this.serverPlayerArray.length; i++)
	{
    		this.check_collision( this.serverPlayerArray[i] );
	}
	
	for (var i = 0; i < this.serverPlayerArray.length; i++)
	{
    		this.serverPlayerArray[i].inputs = []; //we have cleared the input buffer, so remove this
	}
}, 

    	//Makes sure things run smoothly and notifies clients of changes
    	//on the server side
server_update: function()
{
        //Update the state of our local clock to match the timer
    	this.server_time = this.local_time;

        //Make a snapshot of the current state, for updating the clients
	this.lastStateArray = [];
	for (var p = 0; p < this.serverPlayerArray.length; p++)
	{
		this.lastStateArray.push(this.serverPlayerArray[p].pos);
	}
	for (var p = 0; p < this.serverPlayerArray.length; p++)
	{
		this.lastStateArray.push(this.serverPlayerArray[p].last_input_seq);
	}
	this.lastStateArray.push(this.server_time);

        //Send the snapshot of the players
	for (var i = 0; i < this.serverPlayerArray.length; i++)
	{
		if (this.serverPlayerArray[i].serverClient.client)
		{
        		this.serverPlayerArray[i].serverClient.client.emit( 'onserverupdate', this.lastStateArray );
		}
	}
}, 

handle_server_input: function(client, input, input_time, input_seq) 
{
	client.serverClient.serverPlayer.inputs.push({inputs:input, time:input_time, seq:input_seq});
}, 

create_timer: function()
{
	setInterval(function()
	{
        	this._dt = new Date().getTime() - this._dte;
        	this._dte = new Date().getTime();
        	this.local_time += this._dt/1000.0;
    	}.bind(this), 4);
},

create_physics_simulation: function() 
{
	setInterval(function()
	{
        	this._pdt = (new Date().getTime() - this._pdte)/1000.0;
        	this._pdte = new Date().getTime();
        	this.update_physics();
    	}.bind(this), 15);
} 

});

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };

module.exports = ServerCore;
