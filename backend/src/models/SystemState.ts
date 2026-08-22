import { Schema, model } from "mongoose";

export interface SystemState {
  _id: string;
  revision: number;
  updatedAt: Date;
}

const systemStateSchema = new Schema(
  {
    _id: {
      type: String,
      required: true
    },
    revision: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false
  }
);

export const SystemStateModel = model<SystemState>("SystemState", systemStateSchema);
