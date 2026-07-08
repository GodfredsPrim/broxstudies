import { useState, useEffect, useCallback, useRef } from 'react'
import { questionsApi } from '@/api/endpoints'
import type { GenerationJob } from '@/api/types'

interface UseGenerationOptions {
  onComplete?: (job: GenerationJob) => void
  onError?: (job: GenerationJob) => void
  pollInterval?: number
}

export function useGeneration(options: UseGenerationOptions = {}) {
  const { onComplete, onError, pollInterval = 2000 } = options
  const [activeJobs, setActiveJobs] = useState<Map<string, GenerationJob>>(new Map())
  const [completedJobs, setCompletedJobs] = useState<GenerationJob[]>([])

  // Keep a ref so the interval can read current jobs without being in the dep array
  const activeJobsRef = useRef(activeJobs)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  useEffect(() => { activeJobsRef.current = activeJobs }, [activeJobs])
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const activeCount = activeJobs.size

  // Poll for job status updates — only recreate interval when job count changes
  useEffect(() => {
    if (activeCount === 0) return

    const interval = setInterval(async () => {
      for (const [jobId, job] of activeJobsRef.current) {
        if (job.status === 'completed' || job.status === 'failed') continue

        try {
          const updatedJob = await questionsApi.getJobStatus(jobId)
          const finished = updatedJob.status === 'completed' || updatedJob.status === 'failed'

          // Finished jobs must LEAVE activeJobs — otherwise the generate
          // button stays disabled forever and this interval polls for nothing.
          setActiveJobs(prev => {
            const newMap = new Map(prev)
            if (finished) newMap.delete(jobId)
            else newMap.set(jobId, updatedJob)
            return newMap
          })

          if (updatedJob.status === 'completed') {
            setCompletedJobs(prev => [updatedJob, ...prev.slice(0, 9)])
            onCompleteRef.current?.(updatedJob)
          } else if (updatedJob.status === 'failed') {
            onErrorRef.current?.(updatedJob)
          }
        } catch (error) {
          console.error(`Failed to check job ${jobId}:`, error)
        }
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [activeCount, pollInterval])

  const startGeneration = useCallback(async (requestData: any): Promise<string> => {
    const response = await questionsApi.generate(requestData)
    const jobId = response.job_id

    // Add to active jobs
    const initialJob: GenerationJob = {
      id: 0, // Will be set by server
      job_id: jobId,
      user_id: null,
      status: 'pending',
      request_data: requestData,
      result_data: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    }

    setActiveJobs(prev => new Map(prev).set(jobId, initialJob))
    return jobId
  }, [])

  const getJob = useCallback((jobId: string): GenerationJob | undefined => {
    return activeJobs.get(jobId)
  }, [activeJobs])

  const clearCompletedJob = useCallback((jobId: string) => {
    setCompletedJobs(prev => prev.filter(job => job.job_id !== jobId))
  }, [])

  const clearAllCompleted = useCallback(() => {
    setCompletedJobs([])
  }, [])

  return {
    activeJobs: Array.from(activeJobs.values()),
    completedJobs,
    startGeneration,
    getJob,
    clearCompletedJob,
    clearAllCompleted,
  }
}