//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//Code below is from Three.js, and sourced from links below

    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel

/* The ClientCore class */
var ClientCore = new Class(
{
initialize: function()
{

	this.MAX_NUMBER_OF_PLAYERS = 3;

  	//Used in collision etc.
	this.clientWorld = new ClientWorld(720,480);

	this.mClientPlayer = 0;
		
	//clients and players and ghosts
	this.clientPlayerArray = new Array();
	this.ghostPlayerArray = new Array();
	this.lerpPlayerArray = new Array();

	for (var i = 0; i < this.MAX_NUMBER_OF_PLAYERS; i++)
	{
		this.clientPlayerArray.push(new ClientPlayer(this));
	
        	//Debugging ghosts, to help visualise things
		this.ghostPlayerArray.push(new ClientPlayer(this));
	
		this.lerpPlayerArray.push(new ClientPlayer(this));
	}
	for (var i = 0; i < this.clientPlayerArray.length; i++)
	{
        	this.clientPlayerArray[i].pos.set(200,200,0);
        	this.ghostPlayerArray[i].pos.set(200,200,0);
        	this.lerpPlayerArray[i].pos.set(200,200,0);
	}

        this.lerpPlayerArray[1].info_color = 'rgba(255,255,255,0.1)';

        this.ghostPlayerArray[0].info_color = 'rgba(255,255,255,0.2)';
        this.ghostPlayerArray[1].info_color = 'rgba(255,255,255,0.2)';

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

        //Create a keyboard handler
        this.keyboard = new THREEx.KeyboardState();

        //Create the default configuration settings
        this.client_create_configuration();

        //A list of recent server updates we interpolate across
        //This is the buffer that is the driving factor for our networking
        this.server_updates = [];

        //Connect to the socket.io server!
        this.client_connect_to_server();

        //We start pinging the server to determine latency
        this.client_create_ping_timer();

        //Set their colors from the storage or locally
        this.color = localStorage.getItem('color') || '#cc8822' ;
        localStorage.setItem('color', this.color);
        this.clientPlayerArray[0].color = this.color;

        //Make this only if requested
        if(String(window.location).indexOf('debug') != -1) 
	{
		this.client_create_debug_gui();
	}
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
v_sub: function(a,b) 
{ 
	return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; 
},

//Multiply a 2d vector with a scalar value and return the resulting vector
v_mul_scalar: function(a,b) 
{ 
	return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; 
},
    
//For the server, we need to cancel the setTimeout that the polyfill creates
stop_update: function() 
{  
	window.cancelAnimationFrame( this.updateid );  
},

//Simple linear interpolation
lerp: function(p, n, t) 
{ 
	var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); 
},

//Simple linear interpolation between 2 vectors
v_lerp: function(v,tv,t) 
{ 
	return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; 
},

/*

 Common functions
 
    These functions are shared between client and server, and are generic
    for the game state. The client functions are client_* and server functions
    are server_* so these have no prefix.

*/

    //Main update loop
update: function(t) 
{
        //Work out the delta time
    	this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;

        //Store the last frame time
    	this.lastframetime = t;

        //Update the game specifics
	this.client_update();

        //schedule the next update
    	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
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

 Client side functions

    These functions below are specific to the client side only,
    and usually start with client_* to make things clearer.

*/

client_handle_input: function()
{
	//if(this.lit > this.local_time) return;
    	//this.lit = this.local_time+0.5; //one second delay

        //This takes input from the client and keeps a record,
        //It also sends the input information to the server immediately
        //as it is pressed. It also tags each input with a sequence number.

    	var x_dir = 0;
    	var y_dir = 0;
    	var input = [];
    	this.client_has_input = false;

    	if( this.keyboard.pressed('A') ||
        this.keyboard.pressed('left')) 
	{
        	x_dir = -1;
            	input.push('l');
       	} //left

    	if ( this.keyboard.pressed('D') ||
        this.keyboard.pressed('right')) 
	{
        	x_dir = 1;
            	input.push('r');
        } //right

    	if( this.keyboard.pressed('S') ||
        this.keyboard.pressed('down')) 
	{
            	y_dir = 1;
            	input.push('d');
        } //down

    	if( this.keyboard.pressed('W') ||
        this.keyboard.pressed('up')) 
	{
            	y_dir = -1;
            	input.push('u');
        } //up

    	if(input.length) 
	{

        	//Update what sequence we are on now
        	this.input_seq += 1;

            	//Send the packet of information to the server.
            	//The input packets are labelled with an 'i' in front.
        	var server_packet = 'i.';
           	server_packet += input.join('-') + '.';
            	server_packet += this.local_time.toFixed(3).replace('.','-') + '.';
            	server_packet += this.input_seq;

            	//Go
        	this.socket.send(  server_packet  );

            	//Return the direction if needed
        	return this.physics_movement_vector_from_direction( x_dir, y_dir );
    	} 
	else 
	{
        	return {x:0,y:0};
    	}
},

client_process_net_updates: function() 
{

	//No updates...
    	if(!this.server_updates.length) 
	{
		return;
	}

    	//First : Find the position in the updates, on the timeline
    	//We call this current_time, then we find the past_pos and the target_pos using this,
    	//searching throught the server_updates array for current_time in between 2 other times.
    	// Then :  other player position = lerp ( past_pos, target_pos, current_time );

        //Find the position in the timeline of updates we stored.
    	var current_time = this.client_time;
    	var count = this.server_updates.length-1;
    	var target = null;
    	var previous = null;

        //We look from the 'oldest' updates, since the newest ones
        //are at the end (list.length-1 for example). This will be expensive
        //only when our time is not found on the timeline, since it will run all
        //samples. Usually this iterates very little before breaking out with a target.

	var e = this.clientPlayerArray.length * 2;
	
    	for(var i = 0; i < count; ++i) 
	{
        	var point = this.server_updates[i];
        	var next_point = this.server_updates[i+1];

            	//Compare our point in time with the server times we have
        	if(current_time > point[e] && current_time < next_point[e]) 
		{
            		target = next_point;
            		previous = point;
            		break;
        	}
    	}

        //With no target we store the last known
        //server position and move to that instead
    	if(!target) 
	{
        	target = this.server_updates[0];
        	previous = this.server_updates[0];
    	}

        //Now that we have a target and a previous destination,
        //We can interpolate between then based on 'how far in between' we are.
        //This is simple percentage maths, value/target = [0,1] range of numbers.
        //lerp requires the 0,1 value to lerp to? thats the one.

     	if(target && previous) 
	{
        	this.target_time = target[e];
        	var difference = this.target_time - current_time;
        	var max_difference = (target[e] - previous[e]).fixed(3);
        	var time_point = (difference/max_difference).fixed(3);

            	//Because we use the same target and previous in extreme cases
            	//It is possible to get incorrect values due to division by 0 difference
            	//and such. This is a safe guard and should probably not be here. lol.
        	if( isNaN(time_point) ) time_point = 0;
        	if(time_point == -Infinity) time_point = 0;
        	if(time_point == Infinity) time_point = 0;

            	//The most recent server update
        	var latest_server_data = this.server_updates[ this.server_updates.length-1 ];

		for (var i = 0; i < this.MAX_NUMBER_OF_PLAYERS; i++)
		{
            		//update the dest block, this is a simple lerp
        		this.ghostPlayerArray[i].pos = this.pos(latest_server_data[i]);
        		this.lerpPlayerArray[i].pos = this.v_lerp(previous[i], target[i], time_point);

			//client smoothing
            		this.clientPlayerArray[i].pos = this.v_lerp( this.clientPlayerArray[i].pos, this.lerpPlayerArray[i].pos, this._pdt*this.client_smooth);
		}

    	} //if target && previous
}, 

client_onserverupdate_recieved: function(data)
{
        //Store the server time (this is offset by the latency in the network, by the time we get it)
        //this.server_time = data.t;
	var e = this.clientPlayerArray.length * 2;
        this.server_time = data[e];
       
	 //Update our local offset time from the last server update
        this.client_time = this.server_time - (this.net_offset/1000);

        //Cache the data from the server,
        //and then play the timeline
        //back to the player with a small delay (net_offset), allowing
        //interpolation between the points.
        this.server_updates.push(data);

        //we limit the buffer in seconds worth of updates
        //60fps*buffer seconds = number of samples
        if(this.server_updates.length >= ( 60*this.buffer_size )) 
	{
               	this.server_updates.splice(0,1);
        }

        //We can see when the last tick we know of happened.
        //If client_time gets behind this due to latency, a snap occurs
        //to the last tick. Unavoidable, and a reallly bad connection here.
        //If that happens it might be best to drop the game after a period of time.
	var e = this.clientPlayerArray.length * 2;
      	this.oldest_tick = this.server_updates[0][e];
},

client_update: function() 
{
	//Clear the screen area
    	this.ctx.clearRect(0,0,720,480);

        //draw help/information if required
    	this.client_draw_info();

        //Capture inputs from the player
    	this.client_handle_input();
		

        //Network player just gets drawn normally, with interpolation from
        //the server updates, smoothing out the positions from the past.
        //Note that if we don't have prediction enabled - this will also
        //update the actual local client position on screen as well.
        this.client_process_net_updates();

        //Now they should have updated, we can draw the entity
	for (var i = 0; i < this.MAX_NUMBER_OF_PLAYERS; i++)
	{
    		this.clientPlayerArray[i].draw();
	}
        
	//and these
    	if(this.show_dest_pos) 
	{
		for (var i = 0; i < this.MAX_NUMBER_OF_PLAYERS; i++)
		{
       			this.lerpPlayerArray[i].draw();
		}
    	}

        //and lastly draw these
    	if(this.show_server_pos) 
	{
		for (var i = 0; i < this.MAX_NUMBER_OF_PLAYERS; i++)
		{
        		this.ghostPlayerArray[i].draw();
		}
    	}

        //Work out the fps average
    	this.client_refresh_fps();
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
    	}.bind(this), 15);
},

client_create_ping_timer: function() {

        //Set a ping timer to 1 second, to maintain the ping/latency between
        //client and server and calculated roughly how our connection is doing

    	setInterval(function()
	{
        	this.last_ping_time = new Date().getTime() - this.fake_lag;
        	this.socket.send('p.' + (this.last_ping_time) );
    	}.bind(this), 1000);
},

client_create_configuration: function() 
{
	this.show_help = false;             //Whether or not to draw the help text
    	this.show_server_pos = false;       //Whether or not to show the server position
    	this.show_dest_pos = false;         //Whether or not to show the interpolation goal
    	this.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number
    	this.client_smoothing = true;       //Whether or not the client side prediction tries to smooth things out
    	this.client_smooth = 25;            //amount of smoothing to apply to client update dest

    	this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
    	this.net_ping = 0.001;              //The round trip time from here to the server,and back
    	this.last_ping_time = 0.001;        //The time we last sent a ping
    	this.fake_lag = 0;                //If we are simulating lag, this applies only to the input client (not others)
    	this.fake_lag_time = 0;

    	this.net_offset = 100;              //100 ms latency between server and client interpolation for other clients
    	this.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
    	this.target_time = 0.01;            //the time where we want to be in the server timeline
    	this.oldest_tick = 0.01;            //the last time tick we have available in the buffer

    	this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
    	this.server_time = 0.01;            //The time the server reported it was at, last we heard from it
    
    	this.dt = 0.016;                    //The time that the last frame took to run
    	this.fps = 0;                       //The current instantaneous fps (1/this.dt)
    	this.fps_avg_count = 0;             //The number of samples we have taken for fps_avg
    	this.fps_avg = 0;                   //The current average fps displayed in the debug UI
    	this.fps_avg_acc = 0;               //The accumulation of the last avgcount fps samples

    	this.lit = 0;
    	this.llt = new Date().getTime();
},

client_create_debug_gui: function() 
{
    	this.gui = new dat.GUI();

    	var _playersettings = this.gui.addFolder('Your settings');

        this.colorcontrol = _playersettings.addColor(this, 'color');

        //We want to know when we change our color so we can tell
        //the server to tell the other clients for us
        this.colorcontrol.onChange(function(value) 
	{
        	this.clientPlayerArray[0].color = value;
            	localStorage.setItem('color', value);
            	this.socket.send('c.' + value);
        }.bind(this));

        _playersettings.open();

    	var _othersettings = this.gui.addFolder('Methods');

        _othersettings.add(this, 'client_smoothing').listen();
        _othersettings.add(this, 'client_smooth').listen();

    	var _debugsettings = this.gui.addFolder('Debug view');
        
        _debugsettings.add(this, 'show_help').listen();
        _debugsettings.add(this, 'fps_avg').listen();
        _debugsettings.add(this, 'show_server_pos').listen();
        _debugsettings.add(this, 'show_dest_pos').listen();
        _debugsettings.add(this, 'local_time').listen();

        _debugsettings.open();

    	var _consettings = this.gui.addFolder('Connection');
        _consettings.add(this, 'net_latency').step(0.001).listen();
        _consettings.add(this, 'net_ping').step(0.001).listen();

       	//When adding fake lag, we need to tell the server about it.
        var lag_control = _consettings.add(this, 'fake_lag').step(0.001).listen();
        lag_control.onChange(function(value)
	{
       		this.socket.send('l.' + value);
        }.bind(this));

        _consettings.open();

    	var _netsettings = this.gui.addFolder('Networking');
        
        _netsettings.add(this, 'net_offset').min(0.01).step(0.001).listen();
        _netsettings.add(this, 'server_time').step(0.001).listen();
        _netsettings.add(this, 'client_time').step(0.001).listen();
        //_netsettings.add(this, 'oldest_tick').step(0.001).listen();

        _netsettings.open();
},

client_reset_positions: function() 
{
        //Host always spawns at the top left.
	for (var i = 0; i < this.clientPlayerArray.length; i++)
	{
    		this.clientPlayerArray[i].pos.set(0,0,0);
	}

        //Position all debug view items to their owners position
	for (var i = 0; i < this.clientPlayerArray.length; i++)
	{
    		this.ghostPlayerArray[i].pos = this.pos(this.clientPlayerArray[i].pos);
    		this.lerpPlayerArray[i].pos = this.pos(this.clientPlayerArray[i].pos);
	}
},

client_onreadygame: function(data) 
{
    	var server_time = parseFloat(data.replace('-','.'));
    	this.local_time = server_time + this.net_latency;
},

client_onhostgame: function(data) 
{
    	var server_time = parseFloat(data.replace('-','.'));
    	this.local_time = server_time + this.net_latency;
}, 

client_onconnected: function(data) 
{
	var yourid = data[0];
	data.splice(0, 1);
	for (var i = 0; i < data.length; i++)
	{
		this.clientPlayerArray[i].id = data[i]; 
	}

	//set you
	for (var i = 0; i < this.clientPlayerArray.length; i++)
	{
		//its you
		if (yourid == this.clientPlayerArray[i].id)
		{
			this.mClientPlayer = this.clientPlayerArray[i];
		}
	}
}, 

client_on_otherclientcolorchange: function(data) 
{
	this.clientPlayerArray[1].color = data;
},

client_onping: function(data) 
{
    	this.net_ping = new Date().getTime() - parseFloat( data );
    	this.net_latency = this.net_ping/2;

}, 

client_onnetmessage: function(data) 
{
    	var commands = data.split('.');
    	var command = commands[0];
    	var subcommand = commands[1] || null;
    	var commanddata = commands[2] || null;

    	switch(command) 
	{
        	case 's': //server message

            	switch(subcommand) 
		{
                	case 'h' : //host a game requested
                    		this.client_onhostgame(commanddata); break;
/*
                	case 'j' : //join a game requested
                    		this.client_onjoingame(commanddata); break;
*/

                	case 'r' : //ready a game requested
                    		this.client_onreadygame(commanddata); break;

                	case 'e' : //end game requested
                    		this.client_ondisconnect(commanddata); break;

                	case 'p' : //server ping
                    		this.client_onping(commanddata); break;

                	case 'c' : //other player changed colors
                    		this.client_on_otherclientcolorchange(commanddata); break;
            	} //subcommand

        	break; //'s'
    	} //command
}, 

client_ondisconnect: function(data) 
{
    
	//When we disconnect, we don't know if the other player is
        //connected or not, and since we aren't, everything goes to offline

    	this.clientPlayerArray[0].info_color = 'rgba(255,255,255,0.1)';
    	this.clientPlayerArray[0].state = 'not-connected';

    	this.clientPlayerArray[1].info_color = 'rgba(255,255,255,0.1)';
    	this.clientPlayerArray[1].state = 'not-connected';
    	
	this.clientPlayerArray[2].info_color = 'rgba(255,255,255,0.1)';
    	this.clientPlayerArray[2].state = 'not-connected';
}, 

client_connect_to_server: function() 
{
	//Store a local reference to our connection to the server
        this.socket = io.connect();

        //When we connect, we are not 'connected' until we have a server id
        //and are placed in a game by the server. The server sends us a message for that.
        this.socket.on('connect', function()
	{
        	this.clientPlayerArray[0].state = 'connecting';
        }.bind(this));

        //Sent when we are disconnected (network, server down, etc)
        this.socket.on('disconnect', this.client_ondisconnect.bind(this));

        //Sent each tick of the server simulation. This is our authoritive update
        this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
            
	//Handle when we connect to the server, showing state and storing id's.
        this.socket.on('onconnected', this.client_onconnected.bind(this));
	
       	//On error we just show that we are not connected for now. Can print the data.
       	this.socket.on('error', this.client_ondisconnect.bind(this));
        
	//On message from the server, we parse the commands and send it to the handlers
        this.socket.on('message', this.client_onnetmessage.bind(this));
}, 

client_refresh_fps: function() 
{
        //We store the fps for 10 frames, by adding it to this accumulator
    	this.fps = 1/this.dt;
    	this.fps_avg_acc += this.fps;
    	this.fps_avg_count++;

        //When we reach 10 frames we work out the average fps
    	if(this.fps_avg_count >= 10) 
	{
        	this.fps_avg = this.fps_avg_acc/10;
        	this.fps_avg_count = 1;
        	this.fps_avg_acc = this.fps;
    	} //reached 10 frames
},

client_draw_info: function() 
{

        //We don't want this to be too distracting
    	this.ctx.fillStyle = 'rgba(255,255,255,0.3)';

        //They can hide the help with the debug GUI
    	if(this.show_help) 
	{
        	this.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
        	this.ctx.fillText('server_time : last known game time on server', 10 , 70);
        	this.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
        	this.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
        	this.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
        	this.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
        	this.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
        	this.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);

    	} //if this.show_help

        //Draw some information for the host
    	if(this.clientPlayerArray[0] == this.mClientPlayer) 
	{
        	this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        	this.ctx.fillText('You are the host', 10 , 465);
    	} //if we are the host

        //Reset the style back to full white.
    	this.ctx.fillStyle = 'rgba(255,255,255,1)';
}
});

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
