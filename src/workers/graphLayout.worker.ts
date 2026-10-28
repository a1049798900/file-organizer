// 图谱布局 Web Worker：接收布局输入，返回确定性坐标
import {
  computeRadialLayout,
  type GraphLayoutInput,
  type GraphLayoutResult,
} from '../lib/graphLayout';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GraphLayoutInput>) => void) | null;
  postMessage: (message: GraphLayoutResult) => void;
};

scope.onmessage = (event) => {
  scope.postMessage(computeRadialLayout(event.data));
};
