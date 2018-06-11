/*
    The player class

        A simple class to maintain state of a player on screen,
        as well as to draw that state when required.
*/
var ClientPlayer = new Class(
{
initialize: function( clientCore) 
{
        //Store the instance, if any
        this.clientCore = clientCore;

	//Set up initial values for our state information
        this.pos = new ClientPoint3D(0,0,0);
        this.size = { x:16, y:16, hx:8, hy:8 };
        this.state = 'not-connected';
        this.color = 'rgba(255,255,255,0.1)';
        this.info_color = 'rgba(255,255,255,0.1)';
        this.id = '';

        //These are used in moving us around later
        this.state_time = new Date().getTime();
}, 
  
draw: function(){

       	//Set the color for this player
        clientCore.ctx.fillStyle = this.color;

        //Draw a rectangle for us
        clientCore.ctx.fillRect(this.pos.x - this.size.hx, this.pos.y - this.size.hy, this.size.x, this.size.y);

        //Draw a status update
        clientCore.ctx.fillStyle = this.info_color;
	clientCore.ctx.fillText(this.state, this.pos.x+10, this.pos.y + 4);
} 
});
    
