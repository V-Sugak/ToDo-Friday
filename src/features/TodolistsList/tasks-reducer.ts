import {TaskPriorities, TaskStatuses, TaskType, todolistsAPI, UpdateTaskModelType} from '../../api/todolists-api'
import {AppRootStateType} from '../../app/store'
import {setAppStatusAC} from '../../app/app-reducer'
import {handleServerAppError, handleServerNetworkError} from '../../utils/error-utils'
import {addTodolistTC, fetchTodolistsTC, removeTodolistTC} from "./todolists-reducer";
import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";
import {AxiosError} from "axios";

const initialState: TasksStateType = {}

// thunks
export const fetchTasksTC = createAsyncThunk("tasks/fetchTasks", async (todolistId: string, thunkAPI) => {
    thunkAPI.dispatch(setAppStatusAC({status: 'loading'}))
    const res = await todolistsAPI.getTasks(todolistId)
    const tasks = res.data.items
    thunkAPI.dispatch(setAppStatusAC({status: 'succeeded'}))
    return {tasks, todolistId}
})
export const removeTaskTC = createAsyncThunk("tasks/removeTask", async (param: { taskId: string, todolistId: string }, thunkAPI) => {
    todolistsAPI.deleteTask(param.todolistId, param.taskId)
    return {taskId: param.taskId, todolistId: param.todolistId}
})
export const addTaskTC = createAsyncThunk("tasks/addTask", async (param: { title: string, todolistId: string }, {
    dispatch,
    rejectWithValue
}) => {
    dispatch(setAppStatusAC({status: 'loading'}))
    try {
        const res = await todolistsAPI.createTask(param.todolistId, param.title)
        if (res.data.resultCode === 0) {
            const task = res.data.data.item
            dispatch(setAppStatusAC({status: 'succeeded'}))
            return {task}
        } else {
            handleServerAppError(res.data, dispatch);
            return rejectWithValue({})
        }
    } catch (err) {
        const error: AxiosError = err as any;
        handleServerNetworkError(error, dispatch)
        return rejectWithValue({})
    }
})
export const updateTaskTC = createAsyncThunk("tasks/updateTask",
    async (param: { taskId: string, domainModel: UpdateDomainTaskModelType, todolistId: string }, thunkAPI) => {
        const state = thunkAPI.getState() as AppRootStateType
        const task = state.tasks[param.todolistId].find(t => t.id === param.taskId)
        if (!task) {
            return thunkAPI.rejectWithValue('task not found in the state')
        }

        const apiModel: UpdateTaskModelType = {
            deadline: task.deadline,
            description: task.description,
            priority: task.priority,
            startDate: task.startDate,
            title: task.title,
            status: task.status,
            ...param.domainModel
        }
        try {
            const res = await todolistsAPI.updateTask(param.todolistId, param.taskId, apiModel)

            if (res.data.resultCode === 0) {
                return {
                    taskId: param.taskId,
                    model: param.domainModel,
                    todolistId: param.todolistId
                }
            } else {
                handleServerAppError(res.data, thunkAPI.dispatch);
                return thunkAPI.rejectWithValue(null)
            }
        } catch (err) {
            const error: AxiosError = err as any;
            handleServerNetworkError(error, thunkAPI.dispatch);
            return thunkAPI.rejectWithValue(null)
        }
    })

const slice = createSlice({
    name: "tasks",
    initialState: initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(addTodolistTC.fulfilled, (state, action) => {
            state[action.payload.todolist.id] = []
        })
        builder.addCase(removeTodolistTC.fulfilled, (state, action) => {
            delete state[action.payload.id]
        })
        builder.addCase(fetchTodolistsTC.fulfilled, (state, action) => {
            action.payload.todolists.forEach((tl: any) => {
                state[tl.id] = []
            })
        })
        builder.addCase(fetchTasksTC.fulfilled, (state, action) => {
            state[action.payload.todolistId] = action.payload.tasks
        })
        builder.addCase(removeTaskTC.fulfilled, (state, action) => {
            const tl = state[action.payload.todolistId]
            const index = tl.findIndex(t => t.id === action.payload.taskId)
            if (index > -1) {
                tl.splice(index, 1)
            }
        })
        builder.addCase(addTaskTC.fulfilled, (state, action) => {
            state[action.payload.task.todoListId].unshift(action.payload.task)
        })
        builder.addCase(updateTaskTC.fulfilled, (state, action) => {
            const tl = state[action.payload.todolistId]
            const index = tl.findIndex(t => t.id === action.payload.taskId)
            if (index > -1) {
                tl[index] = {...tl[index], ...action.payload.model}
            }
        })
    }
})

export const tasksReducer = slice.reducer

// types
export type UpdateDomainTaskModelType = {
    title?: string
    description?: string
    status?: TaskStatuses
    priority?: TaskPriorities
    startDate?: string
    deadline?: string
}
export type TasksStateType = {
    [key: string]: Array<TaskType>
}
