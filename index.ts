import express from 'express';
import axios from 'axios';
// import { CreateJWTtoken } from './services/jwtToken';
import { GoogleTokenResult } from './interfaces/googleTokenResult';
import cors from 'cors'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
import bodyParser from 'body-parser'
dotenv.config();

const app = express();
app.use(cors())
// Middleware to parse JSON bodies
// app.use(express.json());

// Middleware to parse URL-encoded bodies
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: "50mb",
 extended: true, parameterLimit: 500000 }))

/////////////mongo db///////
import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const imageSchema = new Schema({
  myFile: {
    type: String,
  },
});

const userSchema = new Schema({
  // _id:{
  //   type:String
  // },
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
    image: {
      type: [imageSchema],
    },
    likes: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    },
    postedAt:{
      type : Date
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
////////////////abowe is un authorizes requests/////////
// app.use(verifyRequest);

//////////authorized reuestes only///

app.post("/post", verifyRequest, async(req, res)=>{
  try {
    const {content, image} = req.body;
    console.log("payload from /post", req.payload)
    const {id, email} = req.payload;
    const result = await User.updateOne(
      { _id: id },
      {
        $push: {
          posts: {
            content: content,
            image: [image],
            postedAt : new Date()
          }
        }
      }
    );
    return res.status(201).json({message:"post added succesfully"})
  } catch (error) {
    console.error('Error adding post:', error);
  }
})

app.get("/tweets", async(req, res)=>{
  console.log("visited /tweets")
  try{
    const tweets = await User.find(
      { },
      {
        _id : 1,
        firstName: 1,
        email: 1,
        posts: 1,
        profileImageURL: 1
      }
    );
    
    const transformedArrayOfTweets = tweets.flatMap(user => {
      return user.posts.map(post => ({
        userId: user._id,
        firstName: user.firstName,
        email: user.email,
        profileImageURL: user.profileImageURL,
        content: post.content,
        image: post.image.map(img => ({ myFile: img.myFile })),
        postId: post._id,
        likes: post.likes,
        views: post.views,
        postedAt: post.postedAt
      }));
    });
    
    console.log("large tweets has sent")

    return res.json(transformedArrayOfTweets);
  }catch(err){
    console.log("/tweets error", err);
  }
  
})

app.listen(8080, ()=>{
  console.log("server is running at port 8080");
})

function verifyRequest(req, res, next) {
  console.log("verified request visited");

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: "unauthorized" });
  }

  const bearerToken = authHeader.split(' ');
  const token = bearerToken[1];

  console.log("token", token);

  jwt.verify(token, process.env.UserJWTTokenSecret, async(err, payload) => {
    if (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: "unauthorized" });
      } else {
        return res.status(401).json({ message: err.message });
      }
    }
      req.payload = payload;
      console.log("verify req payload", payload);
      console.log("verify request payload", req.payload);
  
      next();
    
    
  });
}