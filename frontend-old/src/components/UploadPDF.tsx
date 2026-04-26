import { useState } from 'react';
import { uploadAPI } from '../services/api';

export function UploadPDF() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [fileType, setFileType] = useState('syllabus');
  const [subject, setSubject] = useState('mathematics');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await uploadAPI.uploadPDF(file, fileType, subject);
      setMessage(`✓ Uploaded "${result.filename}" - ${result.pages} pages, ${result.chunks} chunks`);
    } catch (error) {
      setMessage(`✗ Error uploading file: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-section">
      <h2>Upload PDF Files</h2>
      <div className="form-group">
        <label htmlFor="fileType">File Type:</label>
        <select 
          id="fileType"
          value={fileType} 
          onChange={(e) => setFileType(e.target.value)}
        >
          <option value="syllabus">Syllabus</option>
          <option value="past_question">Past Questions</option>
          <option value="textbook">Textbook</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="subject">Subject:</label>
        <select 
          id="subject"
          value={subject} 
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="mathematics">Mathematics</option>
          <option value="english">English</option>
          <option value="science">Science</option>
          <option value="social_studies">Social Studies</option>
          <option value="ict">ICT</option>
          <option value="electives">Electives</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="pdfFile">Select PDF:</label>
        <input 
          id="pdfFile"
          type="file" 
          accept=".pdf"
          onChange={handleFileUpload}
          disabled={loading}
        />
      </div>

      {loading && <p className="loading">Uploading...</p>}
      {message && <p className="message">{message}</p>}
    </div>
  );
}
