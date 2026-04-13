import React, { useState, useEffect } from 'react';
import { resourcesAPI } from '../services/api';
import '../styles/ResourceFetcher.css';

interface Subject {
  name: string;
  url: string;
}

interface FetchStatus {
  is_fetching: boolean;
  status: string;
  progress: number;
  message: string;
  results?: any;
}

interface AvailableResources {
  [year: string]: Subject[];
}

export const ResourceFetcher: React.FC = () => {
  const [availableResources, setAvailableResources] = useState<AvailableResources>({});
  const [selectedYears, setSelectedYears] = useState<string[]>(['year_1']);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([
    'syllabi',
    'past_questions',
    'textbooks',
  ]);
  const [autoProcess, setAutoProcess] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null);
  const [error, setError] = useState<string>('');
  const [expandedYear, setExpandedYear] = useState<string>('year_1');

  // Fetch available resources on component mount
  useEffect(() => {
    const loadAvailableResources = async () => {
      try {
        setIsLoading(true);
        const data = await resourcesAPI.getAvailableResources();
        setAvailableResources(data.data);
      } catch (err) {
        setError('Failed to load available resources');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAvailableResources();
  }, []);

  // Poll for fetch status when fetching
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (fetchStatus?.is_fetching) {
      interval = setInterval(async () => {
        try {
          const status = await resourcesAPI.getFetchStatus();
          setFetchStatus(status);
        } catch (err) {
          console.error('Error checking fetch status:', err);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchStatus?.is_fetching]);

  const handleStartFetch = async () => {
    try {
      setError('');
      await resourcesAPI.fetchCurriculumResources(
        selectedYears.length > 0 ? selectedYears : undefined,
        selectedSubjects.length > 0 ? selectedSubjects : undefined,
        resourceTypes,
        autoProcess
      );

      setFetchStatus({
        is_fetching: true,
        status: 'starting',
        progress: 0,
        message: 'Initializing fetch...',
      });
    } catch (err) {
      setError(`Failed to start fetch: ${err}`);
      console.error(err);
    }
  };

  const handleCancelFetch = async () => {
    try {
      await resourcesAPI.cancelFetch();
      setFetchStatus(null);
    } catch (err) {
      setError(`Failed to cancel fetch: ${err}`);
      console.error(err);
    }
  };

  const toggleYear = (year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const toggleResourceType = (type: string) => {
    setResourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const getSubjectsForYear = (year: string): Subject[] => {
    return availableResources[year] || [];
  };

  const isAnyYearSelected = selectedYears.length > 0;
  const isAnyResourceTypeSelected = resourceTypes.length > 0;

  return (
    <div className="resource-fetcher">
      <div className="resource-fetcher__container">
        <h2 className="resource-fetcher__title">
          📚 Get Books Here
        </h2>
        <p className="resource-fetcher__subtitle">
          Download textbooks, past questions, and syllabi for offline study.
        </p>

        {error && (
          <div className="resource-fetcher__error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Fetch Status Display */}
        {fetchStatus?.is_fetching && (
          <div className="resource-fetcher__status">
            <div className="status-header">
              <h3>📥 Fetching Resources...</h3>
              <button
                className="status-cancel-btn"
                onClick={handleCancelFetch}
              >
                Cancel
              </button>
            </div>

            <div className="status-message">{fetchStatus.message}</div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${fetchStatus.progress}%` }}
              />
            </div>

            <div className="status-details">
              <div>
                <strong>Status:</strong> {fetchStatus.status}
              </div>
              <div>
                <strong>Progress:</strong> {Math.round(fetchStatus.progress)}%
              </div>
            </div>

            {fetchStatus.results && (
              <div className="status-results">
                <h4>📊 Results Summary:</h4>
                <div className="results-grid">
                  {fetchStatus.results.fetch_summary && (
                    <>
                      <div className="result-item">
                        <span className="result-label">Resources Downloaded:</span>
                        <span className="result-value">
                          {fetchStatus.results.fetch_summary.downloaded}
                        </span>
                      </div>
                      <div className="result-item">
                        <span className="result-label">Total Resources:</span>
                        <span className="result-value">
                          {fetchStatus.results.fetch_summary.total_resources}
                        </span>
                      </div>
                      <div className="result-item">
                        <span className="result-label">Failed:</span>
                        <span className="result-value">
                          {fetchStatus.results.fetch_summary.failed}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Panel */}
        {!fetchStatus?.is_fetching && (
          <div className="resource-fetcher__config">
            {/* Years Selection */}
            <div className="config-section">
              <h3 className="section-title">Select Years</h3>
              <div className="checkbox-group">
                {['year_1', 'year_2'].map((year) => (
                  <label key={year} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(year)}
                      onChange={() => toggleYear(year)}
                    />
                    <span>{year === 'year_1' ? 'Year 1' : year === 'year_2' ? 'Year 2' : 'Year 3'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Resource Types Selection */}
            <div className="config-section">
              <h3 className="section-title">Resource Types</h3>
              <div className="checkbox-group">
                {[
                  { value: 'syllabi', label: '📋 Syllabi' },
                  { value: 'past_questions', label: '❓ Past Questions' },
                  { value: 'textbooks', label: '📖 Textbooks' },
                ].map(({ value, label }) => (
                  <label key={value} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={resourceTypes.includes(value)}
                      onChange={() => toggleResourceType(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subjects Selection */}
            {isAnyYearSelected && (
              <div className="config-section">
                <h3 className="section-title">
                  Select Subjects (Optional - leave blank for all)
                </h3>
                {selectedYears.map((year) => {
                  const subjects = getSubjectsForYear(year);
                  return (
                    <div key={year} className="year-subjects">
                      <button
                        className="year-toggle"
                        onClick={() =>
                          setExpandedYear(expandedYear === year ? '' : year)
                        }
                      >
                        {expandedYear === year ? '▼' : '▶'} {year.toUpperCase()}
                        ({subjects.length} subjects)
                      </button>

                      {expandedYear === year && (
                        <div className="subjects-list">
                          {subjects.map((subject) => (
                            <label key={subject.name} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={selectedSubjects.includes(subject.name)}
                                onChange={() => toggleSubject(subject.name)}
                              />
                              <span>{subject.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Options */}
            <div className="config-section">
              <h3 className="section-title">Options</h3>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={(e) => setAutoProcess(e.target.checked)}
                />
                <span>Auto-process PDFs after download</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="config-actions">
              <button
                className="btn btn-primary"
                onClick={handleStartFetch}
                disabled={!isAnyYearSelected || !isAnyResourceTypeSelected}
              >
                🚀 Start Fetching Resources
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!availableResources || Object.keys(availableResources).length === 0 && !isLoading && (
          <div className="resource-fetcher__empty">
            <p>Loading available resources...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceFetcher;
