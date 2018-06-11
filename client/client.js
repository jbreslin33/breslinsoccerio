//A window global for our game root variable.
var clientCore = {};

//When loading, we store references to our
//drawing canvases, and initiate a game instance.
window.onload = function()
{
	//setup stuff
	var frame_time = 60/1000; // run the local game at 16ms/ 60hz
	if('undefined' != typeof(global)) frame_time = 45; //on server we run at 45ms, 22hz

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

	clientCore = new ClientCore();

	//Fetch the viewport
	clientCore.viewport = document.getElementById('viewport');
			
	//Adjust their size
	clientCore.viewport.width = clientCore.clientWorld.width;
	clientCore.viewport.height = clientCore.clientWorld.height;

	//Fetch the rendering contexts
	clientCore.ctx = clientCore.viewport.getContext('2d');

	//Set the draw style for the font
	clientCore.ctx.font = '11px "Helvetica"';

	//Finally, start the loop
	clientCore.update( new Date().getTime() );
}; 
