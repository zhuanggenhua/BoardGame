import { UGCRuntimeView } from './UGCRuntimeView';

export function UGCRuntimeViewPage() {
  return (
    <div className="w-screen h-screen bg-slate-950">
      <UGCRuntimeView mode="iframe" className="h-full w-full" />
    </div>
  );
}

export default UGCRuntimeViewPage;
