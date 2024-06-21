// types/User.ts
import mongoose from "mongoose";
export interface IUser {
  _id:String,
  email: string;
  firstName: string;
  profileImageURL?: string;
  posts: {
    content: string;
    image: string[];
    likes: number;
    views: number;
  }[];
  comments: string[];
  followers: mongoose.Schema.Types.ObjectId[];
  following: mongoose.Schema.Types.ObjectId[];
  createdAt?: Date;
  role?: string;
}
