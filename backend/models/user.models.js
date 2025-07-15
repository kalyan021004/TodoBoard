import mongoose from "mongoose";
import bcrypt from "bcrypt";
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: [3, 'Username must be minimum 3characters long'],
            maxlength: [30, 'Username must be minimum 3characters long']

        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']


        },
        password: {
            type: String,
            required: true,
            minlength: [6, 'PAssword must be minimum 6 characters long'],

        },
          activeTaskCount: { type: Number, default: 0 },

        createdAt: {
            type: Date,
            default: Date.now
        }


    }
);
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt)
    next();

});
userSchema.methods.comparePassword = async function (candiadatePassword) {
    return await bcrypt.compare(candiadatePassword, this.password)

}

userSchema.method.toJson = function () {
    const user = this.toObject();
    delete user.password;
    return user;
}

const User = mongoose.model('User', userSchema);

export default User;



