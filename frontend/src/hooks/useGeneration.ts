import { useState, useEffect, useCallback } from 'react'
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

  // Poll for job status updates
  useEffect(() => {
    if (activeJobs.size === 0) return

    const interval = setInterval(async () => {
      for (const [jobId, job] of activeJobs) {
        if (job.status === 'completed' || job.status === 'failed') continue

        try {
          const updatedJob = await questionsApi.getJobStatus(jobId)
          setActiveJobs(prev => {
            const newMap = new Map(prev)
            newMap.set(jobId, updatedJob)
            return newMap
          })

          if (updatedJob.status === 'completed') {
            setCompletedJobs(prev => [updatedJob, ...prev.slice(0, 9)]) // Keep last 10
            onComplete?.(updatedJob)
          } else if (updatedJob.status === 'failed') {
            onError?.(updatedJob)
          }
        } catch (error) {
          console.error(`Failed to check job ${jobId}:`, error)
        }
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [activeJobs, pollInterval, onComplete, onError])

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