import User from '../models/user.models.js';
import { verifyToken } from '../utils/jwt.js';


export const authenticate =async (req,res,next)=>{
    try{
        const token =req.header('Authorization')?.replace('Bearer','');
        if(!token){
             res.status(401).json({
            success:false,
            message:'No Token Provided'
        })

        }
        const decoded=verifyToken(token);

        const user=await User.findById(decoded.userId);
        if(!user){
             res.status(401).json({
            success:false,
            message:'Token is Not Valid'
        })
        }


        req.user=user;
        next()

    }catch(err){
        res.status(401).json({
            success:false,
            message:'Token is Not Valid'
        })

    }
}