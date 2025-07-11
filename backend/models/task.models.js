import mongoose from "mongoose";
const Schema = mongoose.Schema;

const taskSchema = Schema({
    title: {
        type: String,
        required: [true, 'Task title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    assignedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Task must be assigned to a user']
    },
    status: {
        type: String,
        enum: ['todo', 'in-progress', 'done'], // Changed 'completed' to 'done'
        default: 'todo'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    position: {
        type: Number,
        default: 0 // For drag-and-drop ordering
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    board: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Board',
        default: null
    }
}, { timestamps: true });

// Indexes for performance
taskSchema.index({ assignedUser: 1, status: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1, position: 1 }); // For Kanban ordering
taskSchema.index({ title: 1, board: 1 }, { unique: true });

const Task = mongoose.model('Task', taskSchema);
export default Task;