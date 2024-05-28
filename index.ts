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
app.use(bodyParser.json({ limit: '50mb' }));
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

const messageSchema = new Schema({
  receiver: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  img: {
    type: imageSchema,
    required: false
  },
  time: {
    type: Date,
    default: Date.now
  }
});

const postSchema = new Schema({
  content: {
    type: String,
    required: true
  },
  image: {
    type: [imageSchema],
    required: false
  },
  comments: [{
    sender:{
      type:String,
      ref:'User'
    },
    time :{
      type:Date,
      default :Date.now
    },
    msg:{
      text:{
        type:String,
      },
      img:{
        type:imageSchema,
        required: false
      }
    }
  }],
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
});

const userSchema = new Schema({
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
  coverPhoto:{
    type:imageSchema,
  },
  posts:{
    type:[postSchema],
  },
  bio:{
    type:String,
  },
  location:{
    type:String,
  },
  website:{
    type:String,
  },
 
  followers: [{
    type: String,
    ref: 'User'
  }],
  following: [{
    type: String,
    ref: 'User'
  }],
  messages:{
    receiver:{
      type:String,
      ref:'User'
    },
    msg:{
      type:messageSchema,
    }
  },
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
    const fUser = await User.findOne({ email: data.email }).select('_id email firstName profileImageURL followers following createdAt role');
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
        _id: user._id,
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

    return res.status(200).json(transformedArrayOfTweets);
  }catch(err){
    console.log("/tweets error", err);
  }
  
})

app.get("/user", async(req, res)=>{
  try{
  const email = req.query.id;
  const user = await User.findOne({ email: email })
  .select('-messages -posts.comments')
  .exec();
  if(!user){
    return res.status(401).json({message:`user ${email} not found`})
  }
  const transformUserData = (user) => {
    return {
      _id: user._id,
      firstName: user.firstName,
      email: user.email,
      profileImageURL: user.profileImageURL,
      coverPhoto:user.coverPhoto,
      bio:user.bio,
      location:user.location,
      website:user.website,
      createdAt: user.createdAt,
      followers: user.followers || [],
      following: user.following || [],
      posts: user.posts.map(post => ({
        _id: user._id,
        firstName: user.firstName,
        email: user.email,
        profileImageURL: user.profileImageURL,
        content: post.content,
        image: post.image.map(img => ({ myFile: img.myFile })),
        postId: post._id,
        likes: post.likes,
        views: post.views,
        postedAt: post.postedAt
      }))
    };
  };
  const transformedUser = transformUserData(user);
  console.log(transformedUser);
  return res.status(200).json(transformedUser);
  }catch(err){
    console.log("/user error", err);
  }
  
})

app.get("/following/user", async (req, res) => {
  try {
    const email = req.query.id;

    const user = await User.findOne({ email: email })
      .select('following followers firstName email')
      .exec();

    if (user) {
      const hisDetail = {
        firstName: user.firstName,
        email : user.email
      }
      console.log('user from following', user)
      const followingIds = user.following;

      const followingDetails = await User.find({ email: { $in: followingIds } })
        .select('email profileImageURL firstName bio')
        .exec();

      return res.status(200).json({followingDetails, hisDetail});
    } else {
      return res.status(404).json('User not found');
    }
  } catch (error) {
    console.error('Error fetching following details:', error);
    return res.status(500).json('Internal Server Error');
  }
});  

app.get("/followers/user", async (req, res) => {
  try {
    const email = req.query.id;

    const user = await User.findOne({ email: email })
      .select('followers firstName email')
      .exec();

    if (user) {
      const hisDetail = {
        firstName: user.firstName,
        email : user.email
      }
      console.log('user from followers', user)
      const followersIds = user.followers;

      const followersDetails = await User.find({ email: { $in: followersIds } })
        .select('email profileImageURL firstName bio')
        .exec();

      return res.status(200).json({followersDetails, hisDetail});
    } else {
      return res.status(404).json('User not found');
    }
  } catch (error) {
    console.error('Error fetching followers details:', error);
    return res.status(500).json('Internal Server Error');
  }
});  




app.post('/follow', async(req, res)=>{
  try{
    console.log("visited /follow")
    const { follower , following} = req.body;
    const followerUser = await User.findOneAndUpdate(
      { email: follower },
      { $addToSet: { following: following } }, // Add following to the user's following array if it's not already present
      { new: true } // Return the updated document
    );

    const followingUser = await User.findOneAndUpdate(
      { email: following },
      { $addToSet: { followers: follower } }, // Add following to the user's following array if it's not already present
      { new: true } // Return the updated document
    );
  
    if (followerUser && followingUser) {
      // Return only the following list
      console.log(followingUser.following)
      res.status(200).json({ follower: followerUser.following, following: followingUser.followers });
    } else {
      // User not found
      res.status(404).json({ message: 'User not found.' });
    }
  }catch(err){

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