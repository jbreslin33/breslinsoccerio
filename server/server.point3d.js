/*
    Point3d
*/
var ServerPoint3D = new Class(
{
initialize: function(x,y,z) 
{
        this.x = 0;
        this.y = 0;
        this.z = 0;
},
set: function(x,y,z)
{
        this.x = x;
        this.y = y;
        this.z = z;
} 
});
    
module.exports = ServerPoint3D;
