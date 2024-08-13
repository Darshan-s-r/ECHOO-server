import express from 'express';
import axios from 'axios';
// import { CreateJWTtoken } from './services/jwtToken';
import { GoogleTokenResult } from './interfaces/googleTokenResult';
import cors from 'cors'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
import bodyParser from 'body-parser'
import http from 'http';
import socketIo from 'socket.io';
dotenv.config();

const app = express();
const server = http.createServer(app);
import { Server } from 'socket.io';
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
});
app.use(cors())
// Middleware to parse JSON bodies
// app.use(express.json());

// Middleware to parse URL-encoded bodies
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
  limit: "50mb",
  extended: true, parameterLimit: 500000
}))

/////////////mongo db///////
import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const imageSchema = new Schema({
  myFile: {
    type: String,
  },
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
    sender: {
      type: String,
      ref: 'User'
    },
    time: {
      type: Date,
      default: Date.now
    },
    msg: {
      type: String,
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
  postedAt: {
    type: Date
  }
});

const messageSchema = new Schema({
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
  coverPhoto: {
    type: imageSchema,
  },
  posts: {
    type: [postSchema],
  },
  bio: {
    type: String,
  },
  location: {
    type: String,
  },
  website: {
    type: String,
  },

  followers: [{
    type: String,
    ref: 'User'
  }],
  following: [{
    type: String,
    ref: 'User'
  }],
  messages: [{
    receiver: {
      type: String,
      ref: 'User'
    },
    msg: {
      type: [messageSchema]
    }
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
const uri = process.env.LocalMongoURL;
mongoose.connect(uri)
  .then(() => {
    console.log("mongo db connected");
  })

const User = mongoose.model('User', userSchema);

//////////mongo db END/////////

app.post("/", async (req, res) => {
  try {
    const token = req.body.token;
    console.log(req.body);
    const googleURL = new URL("https://oauth2.googleapis.com/tokeninfo")
    googleURL.searchParams.set('id_token', token)

    const { data } = await axios.get<GoogleTokenResult>(googleURL.toString(), {
      responseType: 'json'
    })
    const findUser = await User.findOne({ email: data.email });
    if (!findUser) {
      const newUser = new User({
        email: data.email,
        firstName: data.given_name,
        profileImageURL: data.picture
      })
      const user = await newUser.save();
      console.log("user created succesfully")

    }
    const fUser = await User.findOne({ email: data.email }).select('_id email firstName profileImageURL followers following createdAt role');
    if (!fUser) {
      throw new Error("can't find the user");
    }
    const payload = {
      id: fUser._id,
      email: fUser.email
    };
    const secret = process.env.UserJWTTokenSecret || "sssxgc76ib5w767t68553g8f";
    const options = { expiresIn: '1d' };
    const newToken = jwt.sign(payload, secret, options);

    return res.status(200).json({ token: newToken, user: fUser });
  }
  catch (err) {
    console.log(err);
  }


})
////////////////abowe is un authorizes requests/////////
// app.use(verifyRequest);

//////////authorized routes only///

app.post("/post", verifyRequest, async (req, res) => {
  try {
    const { content, image } = req.body;
    console.log("payload from /post", req.payload)
    const { id, email } = req.payload;
    const result = await User.updateOne(
      { _id: id },
      {
        $push: {
          posts: {
            content: content,
            image: [image],
            postedAt: new Date()
          }
        }
      }
    );
    return res.status(201).json({ message: "post added succesfully" })
  } catch (error) {
    console.error('Error adding post:', error);
  }
})

app.post('/comments', verifyRequest, async (req, res) => {
  try {
    const { email } = req.payload;
    const { id, comment } = req.body;

    const response = await User.findOneAndUpdate(
      { "posts._id": id },
      {
        $push: {
          "posts.$.comments": { sender: email, msg: comment, time: Date.now() }
        }
      },
      { new: true } 
    );

    if (response) {
      return res.status(200); 
    } else {
      console.log('No document found for the given id:', id);
      return res.status(404).json({ error: 'No document found for the given id' });
    }
  } catch (err) {
    console.error('Error adding comment:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/view', async (req, res) => {
  try {
    const { id } = req.body;
    const response = await User.findOneAndUpdate(
      { "posts._id": id },
      {
        $inc: {
          "posts.$.views": 1
        }
      },
      { new: true }
    )
    if (response) {
      return res.status(200);
    } else {
      console.log('No document found for the given id:', id);
      return res.status(404).json({ error: 'No document found for the given id' });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
})

app.post('/like', async (req, res) => {
  try {
    const { id } = req.body;
    const response = await User.findOneAndUpdate(
      { "posts._id": id },
      {
        $inc: {
          "posts.$.likes": 1
        }
      },
      { new: true }
    )
    if (response) {
      return res.status(200);
    } else {
      console.log('No document found for the given id:', id);
      return res.status(404).json({ error: 'No document found for the given id' });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
})

app.get("/tweets", async (req, res) => {
  console.log("visited /tweets")
  try {
    const tweets = await User.find(
      {},
      {
        _id: 1,
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
        comments: post.comments.length,
        likes: post.likes,
        views: post.views,
        postedAt: post.postedAt
      }));
    });

    return res.status(200).json(transformedArrayOfTweets);
  } catch (err) {
    console.log("/tweets error", err);
  }

})
app.get('/who_to_follow', verifyRequest, async (req, res) => {
  try {
    const { id, email } = req.payload;

    const followingUser = await User.findOne({ email: email })
      .select('following')
      .exec();

    if (!followingUser || !followingUser.following || !Array.isArray(followingUser.following)) {
      return res.status(404).json({ error: 'Following user not found or invalid data' });
    }

    const followingIds = followingUser.following;

    const users = await User.find({ email: { $in: followingIds } })
      .select('following')
      .exec();

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }

    const allUsers = users.reduce((acc, user) => {
      if (user.following && Array.isArray(user.following)) {
        acc = acc.concat(user.following);
      }
      return acc;
    }, []);

    // Filter users not followed by the current user
    const notFollowingUsers = allUsers.filter(user => !followingIds.includes(user) && user !== email);

    if (notFollowingUsers.length === 0) {
      console.log('No users to follow found');
      return res.status(200).json([]);
    }

    // Fetch details of users not followed by the current user
    const notFollowingUsersDetails = await User.find({ email: { $in: notFollowingUsers } })
      .select('email profileImageURL firstName bio')
      .exec();

    console.log("notFollowingUsersDetails", notFollowingUsersDetails);
    return res.json(notFollowingUsersDetails);

  } catch (err) {
    console.log('internal server error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


app.get("/user", async (req, res) => {
  try {
    const email = req.query.id;
    const user = await User.findOne({ email: email })
      .select('-messages -posts.comments')
      .exec();
    if (!user) {
      return res.json({ message: 'user not found' })
    }
    const transformUserData = (user) => {
      return {
        _id: user._id,
        firstName: user.firstName,
        email: user.email,
        profileImageURL: user.profileImageURL,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        location: user.location,
        website: user.website,
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
          comments: post?.comments?.length,
          likes: post.likes,
          views: post.views,
          postedAt: post.postedAt
        }))
      };
    };

    const transformedUser = transformUserData(user);
    return res.status(200).json(transformedUser);
  } catch (err) {
    console.log("/user error", err);
  }

})

app.post('/follow', async (req, res) => {
  try {
    const { follower, following } = req.body;
    const followerUser = await User.findOneAndUpdate(
      { email: follower },
      { $addToSet: { following: following } }, // Add following to the user's following array if it's not already present
      { new: true } 
    );

    const followingUser = await User.findOneAndUpdate(
      { email: following },
      { $addToSet: { followers: follower } }, // Add followers to the user's followers array if it's not already present
      { new: true } 
    );

    if (followerUser && followingUser) {
      return res.status(200).json({ following: followerUser.following});
    } else {
      return res.json({ message: 'user not found' })
    }
  } catch (err) {
      console.log('Internal server error from /follow', err);
  }
})

app.post('/un_follow', async (req, res) => {
  try {
    const { follower, following } = req.body;
    const followerUser = await User.findOneAndUpdate(
      { email: follower },
      { $pull: { following: following } }, // Remove following from the user's following array if it exists
      { new: true } 
    );

    const followingUser = await User.findOneAndUpdate(
      { email: following },
      { $pull: { followers: follower } },
      { new: true }
    );

    if (followerUser && followingUser) {
      return res.status(200).json({ following: followerUser.following });
    } else {
      return res.json({ message: 'user not found' })
    }
  } catch (err) {
    console.log(err);
  }
})

app.get("/following/user", async (req, res) => {
  try {
    const email = req.query.id;

    const user = await User.findOne({ email: email })
      .select('following firstName email')
      .exec();

    if (user) {
      const hisDetail = {
        firstName: user.firstName,
        email: user.email
      }
      console.log('user from following', user)
      const followingIds = user.following;

      const followingDetails = await User.find({ email: { $in: followingIds } })
        .select('email profileImageURL firstName bio')
        .exec();

      return res.status(200).json({ followingDetails, hisDetail });
    }
    return res.json({ message: 'user not found' })
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
        email: user.email
      }
      const followersIds = user.followers;

      const followersDetails = await User.find({ email: { $in: followersIds } })
        .select('email profileImageURL firstName bio')
        .exec();

      return res.status(200).json({ followersDetails, hisDetail });
    } else {
      return res.json({ message: 'user not found' })
    }
  } catch (error) {
    console.error('Error fetching followers details:', error);
    return res.status(500).json('Internal Server Error');
  }
});

app.get('/followers_you_know/users', async (req, res) => {
  try {
    const profileUser = req.query.id1;
    const searchUser = req.query.id2;
    if (profileUser === searchUser) {
      const user = await User.findOne({ email: profileUser })
        .select('followers firstName email')
        .exec();
      if (user) {
        const followersIds = user.following;
        const hisDetail = {
          firstName: user.firstName,
          email: user.email
        }
        const followersDetails = await User.find({ email: { $in: followersIds } })
          .select('email profileImageURL firstName bio')
          .exec();

        return res.status(200).json({ followersDetails, hisDetail });
      }

    }
    const user1 = await User.findOne({ email: profileUser })
      .select('followers')
      .exec()

    const user2 = await User.findOne({ email: searchUser })
      .select('followers firstName email')
      .exec()

    if (user1 && user2) {
      const hisDetail = {
        firstName: user2.firstName,
        email: user2.email
      }
      const user1Followers = user1.followers;
      const user2Followers = user2.followers;
      const commonFollowers = user1Followers.filter(follower => user2Followers.includes(follower));

      const followersDetails = await User.find({ email: { $in: commonFollowers } })
        .select('email profileImageURL firstName bio')
        .exec();

      return res.status(200).json({ followersDetails, hisDetail })
    }
    return res.json({ message: 'user not found' })
  } catch (err) {
    console.log('internal server error', err);
  }

})

app.get('/verified_followers/user', async (req, res) => {
  try {
    console.log('hit verified_followers')
    const email = req.query.id;
    const user = await User.findOne({ email })
      .select('email firstName followers')
      .exec()
    if (user) {
      const followersId = user.followers;
      const hisDetail = {
        firstName: user.firstName,
        email: user.email
      }
      const followersDetails = await User.find({ email: { $in: followersId }, role: "verifiedUser" })
        .select('email firstName profileImageURL bio')
        .exec()
      return res.status(200).json({ hisDetail, followersDetails });
    }
    return res.json({ message: 'user not found' })
  } catch (err) {
    console.log('internal server error', err)
  }
})

app.get('/messages', verifyRequest, async (req, res) => {
  const { email } = req.payload;
  try {

    io.on('connection', (soket) => {
      console.log('a user is connected')
    })

    const receiverEmailResult = await User.aggregate([
      { $match: { email: email } },
      { $unwind: "$messages" },
      { $group: { _id: null, receivers: { $addToSet: "$messages.receiver" } } },
      { $project: { _id: 0, receivers: 1 } }
    ]);

    console.log('receiverEmailResult:', receiverEmailResult);

    const receiverEmails = receiverEmailResult.length > 0 ? receiverEmailResult[0].receivers : [];

    const users = await User.find({ email: { $in: receiverEmails } })
      .select('email profileImageURL firstName')
      .exec();

    return res.json(users);
  } catch (error) {
    console.error('Error fetching receiver emails:', error);
    res.status(500).json({ error: 'An error occurred while fetching receiver emails' });
  }
});



app.get('/searchUser/user', verifyRequest, async (req, res) => {
  const { email } = req.payload
  const searchString = req.query.string;
  console.log('hit /search', searchString);

  // Split the search string into smaller chunks of length 100
  const chunks = splitSearchString(searchString);

  try {
    // Perform searches for each chunk
    const searchPromises = chunks.map(async (chunk) => {
      return await User.find({
        $or: [
          { email: { $regex: chunk, $options: 'i' } },
          { firstName: { $regex: chunk, $options: 'i' } }
        ],
        email: { $ne: email }
      }).select('email firstName profileImageURL');
    });

    // Wait for all search promises to resolve
    const results = await Promise.all(searchPromises);

    // Concatenate the results from all searches
    const users = results.flat();

    return res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    return res.status(500).json({ error: 'An error occurred while searching users.' });
  }
});

// Function to split the search string into chunks
function splitSearchString(searchString) {
  const chunkSize = 100; // Max length for regex search
  const chunks = [];
  for (let i = 0; i < searchString.length; i += chunkSize) {
    chunks.push(searchString.substring(i, i + chunkSize));
  }
  return chunks;
}

app.post('/messages/addUser', verifyRequest, async (req, res) => {
  const { email } = req.payload;
  const { receiverEmail } = req.body;
  const { content, image } = req.body;
  const checkIfExist = await User.findOne({ "messages.receiver": receiverEmail });
  if (!checkIfExist) {
    const updateResult = await User.findOneAndUpdate(
      { email: email },
      {
        $push: {
          messages: {
            receiver: receiverEmail,
            msg: []
          }
        }
      },
      { new: true } // Return the modified document
    );
    console.log('updated result', updateResult)

  }
  const user = await User.findOne({ email: receiverEmail })
    .select('email profileImageURL firstName')
  console.log('/message.addUser user', user)
  return res.json(user);
})

server.listen(8080, () => {
  console.log("server is running at port 8080");
})

function verifyRequest(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: "unauthorized" });
  }

  const bearerToken = authHeader.split(' ');
  const token = bearerToken[1];

  jwt.verify(token, process.env.UserJWTTokenSecret, async (err, payload) => {
    if (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: "unauthorized" });
      } else {
        return res.status(401).json({ message: err.message });
      }
    }
    req.payload = payload;

    next();


  });
}


