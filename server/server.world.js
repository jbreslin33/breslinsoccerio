/*
    The world class

        A simple class to set the out limits of where an object can go.
*/
var ServerWorld = new Class(
{
initialize: function(width,height) 
{
        this.width = width;
        this.height = height;
    } 
});
    
module.exports = ServerWorld;
