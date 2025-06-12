const mongoose=require('mongoose')
const userSchema=new mongoose.Schema({
    name:String,
    email:String,
    password:String,
    googleId: {
        type: String,  
        required: false
    },
    joinedClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Club" }],
    RegisteredEvents:[{type:mongoose.Schema.Types.ObjectId,ref:"Event"}],
}, { timestamps: true });
const userModel=mongoose.model("User",userSchema)
module.exports=userModel