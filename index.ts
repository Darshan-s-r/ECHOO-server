import express from 'express';
import axios from 'axios';
// import { CreateJWTtoken } from './services/jwtToken';
import { GoogleTokenResult } from './interfaces/googleTokenResult';
import cors from 'cors'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
dotenv.config();

const app = express();
app.use(cors())
// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
/////////////mongo db///////
import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const userSchema = new Schema({
  _id:{
    type:String
  },
  email: {
    type: String, 
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  profileImageURL: {
    type: String
  },
  posts: [{
    content: {
      type: String,
      required: true
    },
    image: [{
      type: String
    }],
    likes: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    }
  }],
  comments: [{
    type: String
  }],
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String, 
    default: 'user'
  }
});
const uri = process.env.mongoURL;
mongoose.connect(uri)
.then(()=>{
  console.log("mongo db connected");
}) 

const User = mongoose.model('User', userSchema); 

//////////mongo db END/////////
app.post("/", async(req, res)=>{
  try{
    const token = req.body.token;
  console.log(req.body);
  const googleURL = new URL("https://oauth2.googleapis.com/tokeninfo")
    googleURL.searchParams.set('id_token', token)

    const {data} = await axios.get<GoogleTokenResult>(googleURL.toString(), {
        responseType: 'json'
    })
    console.log(data);
    const findUser = await User.findOne({ email: data.email });
    if(!findUser){
      const newUser = new User({
        email: data.email,
        firstName: data.given_name,
        profileImageURL : data.picture
      })
      const user = await newUser.save();
      console.log("user created succesfully")
      
    }
    const fUser = await User.findOne({email:data.email})
    if(!fUser){
      throw new Error("can't find the user");
    }
    const payload = {
      id: fUser._id,
      email: fUser.email
    };
    const secret = process.env.UserJWTTokenSecret || "sssxgc76ib5w767t68553g8f";
    const options = { expiresIn: '1d' };
    const newToken = jwt.sign(payload, secret, options);
    console.log("newTOken", newToken);
    res.status(200).json({token:newToken, user:fUser});
  }
  catch(err){
    console.log(err);
  }
  
  
})

app.listen(8080, ()=>{
  console.log("server is running at port 8080");
})