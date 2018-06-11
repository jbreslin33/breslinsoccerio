var ServerPoint3D = require('./server.point3d');

/*
    The player class

        A simple class to maintain state of a player on screen,
        as well as to draw that state when required.
*/
var ServerPlayer = new Class(
{
initialize: function( serverCore) 
{
        this.serverCore = serverCore;
	this.client = 0;

            //Set up initial values for our state information
	this.pos = new ServerPoint3D(0,0,0);
        this.size = { x:16, y:16, hx:8, hy:8 };
        this.state = 'not-connected';
        this.color = 'rgba(255,255,255,0.1)';
        this.info_color = 'rgba(255,255,255,0.1)';
        this.id = '';

            //These are used in moving us around later
	this.old_state = new ServerPoint3D(0,0,0);
	this.cur_state = new ServerPoint3D(0,0,0);
        this.state_time = new Date().getTime();

            //Our local history of inputs
        this.inputs = [];

            //The world bounds we are confined to
        this.pos_limits = {
            x_min: this.size.hx,
            x_max: this.serverCore.serverWorld.width - this.size.hx,
            y_min: this.size.hy,
            y_max: this.serverCore.serverWorld.height - this.size.hy
        };
},
setClient: function(client)
{
	this.client = client;
}
});
    
module.exports = ServerPlayer;
