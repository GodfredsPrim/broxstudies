import { useEffect, useState } from 'react';
import { questionsAPI } from '../services/api';

interface LoadingState {
  is_loading: boolean;
  total_files: number;
  loaded_files: number;
  current_file: string;
  current_category: string;
  percentage: number;
  mode: 'fast' | 'ultra' | 'standard';
  results: any;
}

const LoadingProgress = () => {
  const [loading, setLoading] = useState<LoadingState | null>(null);
  const [isLoadingRemaining, setIsLoadingRemaining] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await questionsAPI.getLoadingProgress();
        setLoading(response);
      } catch (error) {
        console.log('Not loading or error:', error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleLoadRemaining = async () => {
    setIsLoadingRemaining(true);
    try {
      await questionsAPI.loadContents();
    } catch (error) {
      console.error('Error loading remaining documents:', error);
      setIsLoadingRemaining(false);
    }
  };

  const hasPartialResults = loading?.results?.past_questions?.status === 'partial';
  const shouldShow = Boolean(loading && (loading.is_loading || hasPartialResults || isLoadingRemaining));

  if (!shouldShow || !loading) {
    return null;
  }

  const modeColors = {
    ultra: 'bg-green-500',
    fast: 'bg-blue-500',
    standard: 'bg-yellow-500'
  };

  const modeLabels = {
    ultra: 'Ultra-Fast (Syllabi Only)',
    fast: 'Fast Mode (Syllabi + Sample Questions)',
    standard: 'Standard Mode (Full Loading)'
  };

  const showLoadRemainingButton = loading.mode === 'fast' && hasPartialResults && !loading.is_loading;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Loading Data</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${modeColors[loading.mode]}`}>
            {modeLabels[loading.mode]}
          </span>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span className="font-bold text-lg text-blue-600">{loading.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-300"
              style={{ width: `${loading.percentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {loading.loaded_files} / {loading.total_files} files
          </div>
        </div>

        <div className="bg-gray-50 rounded p-3 mb-4">
          <p className="text-xs text-gray-600 mb-1">
            <span className="font-semibold">Category:</span> {loading.current_category || 'Ready'}
          </p>
          <p className="text-xs text-gray-600 break-words">
            <span className="font-semibold">Current:</span> {loading.current_file || 'Waiting for the next task...'}
          </p>
        </div>

        {loading.results && (
          <div className="text-xs text-gray-600 space-y-1">
            <div>Syllabi: {loading.results.syllabi?.successful || 0}/{loading.results.syllabi?.total_files || 0}</div>
            <div>Past Questions: {loading.results.past_questions?.successful || 0}/{loading.results.past_questions?.total_files || 0} {loading.results.past_questions?.status === 'partial' && '(partial)'}</div>
            <div>Textbooks: {loading.results.textbooks?.successful || 0}/{loading.results.textbooks?.total_files || 0}</div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center mb-3">
            {loading.is_loading ? 'This may take a few minutes...' : 'Initial data is ready. You can load the remaining files whenever you want.'}
          </p>

          {showLoadRemainingButton && (
            <button
              onClick={handleLoadRemaining}
              disabled={isLoadingRemaining}
              className="w-full px-4 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoadingRemaining ? 'Starting full load...' : 'Load All Documents'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingProgress;
