import { useEffect, useState } from 'react';
import { questionsAPI } from '../services/api';

interface DeferredLoadingProgress {
  status: string;
  message: string;
  percentage?: number;
  current_file?: string;
}

const DeferredLoadingIndicator = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<DeferredLoadingProgress | null>(null);
  const [hasLoadingCompleted, setHasLoadingCompleted] = useState(false);

  useEffect(() => {
    // Poll for deferred loading status
    const interval = setInterval(async () => {
      try {
        const response = await questionsAPI.getLoadingProgress();
        
        // Check if we're in deferred loading status
        if (response?.results?.past_questions?.status === 'deferred') {
          setIsLoading(true);
          setProgress({
            status: 'loading',
            message: 'Loading additional study materials...',
            percentage: response?.percentage || 0,
            current_file: response?.current_file,
          });
        } else if (response?.results?.past_questions?.status === 'deferred' && response?.loaded_files === response?.total_files) {
          // Loading completed
          setIsLoading(false);
          setHasLoadingCompleted(true);
          setTimeout(() => {
            setProgress(null);
            setHasLoadingCompleted(false);
          }, 2000);
        } else if (isLoading && !response?.is_loading) {
          // Loading stopped
          setIsLoading(false);
        }
      } catch (error) {
        // Silently fail - loading endpoint may not be available yet
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Don't show if not loading
  if (!isLoading && !hasLoadingCompleted) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-white rounded-lg shadow-md p-3 max-w-xs">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {hasLoadingCompleted ? (
              <div className="text-green-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            ) : (
              <div className="animate-spin">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">
              {hasLoadingCompleted ? '✓ Study materials ready!' : 'Loading study materials...'}
            </p>
            {!hasLoadingCompleted && progress?.current_file && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {progress.current_file}
              </p>
            )}
          </div>
        </div>
        
        {!hasLoadingCompleted && progress?.percentage && (
          <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DeferredLoadingIndicator;
