export type Landmark = { x: number; y: number; z: number; visibility: number };

export type Analysis = {
  metadata: { fps: number; width: number; height: number; frame_count: number };
  landmark_indices: number[];
  frames: Array<Landmark[] | null>;
  frame_times: number[];
  estimated_frames: boolean[];
};

export type Correction = { frame_index: number; landmark_index: number; x: number; y: number };

export type SlowMotionSpeed = 0.5 | 0.25 | 0.125;

export type SlowMotionSegment = {
  id: number;
  start_frame: number;
  end_frame: number;
  speed: SlowMotionSpeed;
};
