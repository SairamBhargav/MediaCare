import { NativeModule, requireNativeModule } from 'expo';

declare class MediaAnalysisModule extends NativeModule<{}> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<MediaAnalysisModule>('MediaAnalysis');
