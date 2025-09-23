import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../presentation/components/ui/core/Button';
import { apiService } from '../services/api';
import { Form, MultiLanguageText } from '../types/form';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingFormId, setDeletingFormId] = useState<number | null>(null);
  
  // Pagination state
  const [currentPage] = useState(1);
  const [pageSize] = useState(5);
  const [, setTotalPages] = useState(0);
  const [, setTotalCount] = useState(0);

  useEffect(() => {
    loadForms();
  }, [currentPage]);

  const loadForms = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getForms(currentPage, pageSize);
      setForms(data.data);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError('Failed to load forms');
      console.error('Error loading forms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResponses = (formId: number) => {
    navigate(`/responses/${formId}`);
  };

  const handleEdit = (formId: number) => {
    navigate(`/form-builder/${formId}`);
  };

  const handleDelete = async (formId: number) => {
    if (!window.confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingFormId(formId);
      await apiService.deleteForm(formId);
      
      // Reload forms to get updated pagination
      await loadForms();

    } catch (err) {
      setError('Failed to delete form');
      console.error('Error deleting form:', err);
    } finally {
      setDeletingFormId(null);
    }
  };

  const copyFormLink = async (formId: number) => {
    const url = `${window.location.origin}/form/${formId}`;
    try {
      await navigator.clipboard.writeText(url);
      // Simple feedback without external toast library
      const button = document.getElementById(`copy-btn-${formId}`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getText = (text: string | MultiLanguageText): string => {
    if (typeof text === 'string') return text;
    return text.en || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading forms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <img 
            src="/4sale-logo.png" 
            alt="4Sale" 
            className="h-12 sm:h-16 mx-auto mb-4 sm:mb-6"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-4">Form Dashboard</h1>
          <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 px-2">Manage your forms and view submissions</p>
          
          <Link to="/form-builder">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-6 sm:px-8 text-sm sm:text-base">
              <span className="mr-2">+</span>
              Create New Form
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Button
              variant="outline"
              onClick={loadForms}
              className="mt-2 border-red-300 text-red-700"
            >
              Try Again
            </Button>
          </div>
        )}

        {forms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 text-gray-300">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No forms yet</h3>
            <p className="text-gray-600 mb-6">Create your first form to get started</p>
            <Link to="/form-builder">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white border-0">
                <span className="mr-2">+</span>
                Create Your First Form
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => (
              <div key={form.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{getText(form.title)}</h3>
                      {form.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{getText(form.description)}</p>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center ml-3">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                    </svg>
                    Created {new Date(form.createdAt).toLocaleDateString()}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Fields:</span>
                      <span className="text-sm font-medium text-gray-900">{form.fields.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        Active
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyFormLink(form.id)}
                      id={`copy-btn-${form.id}`}
                      className="border-gray-300 text-gray-700 text-xs"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                      </svg>
                      Copy Link
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/form/${form.id}`, '_blank')}
                      className="border-gray-300 text-gray-700 text-xs"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Preview
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(form.id)}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                      Edit
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(form.id)}
                      loading={deletingFormId === form.id}
                      className="border-red-300 text-red-700 hover:bg-red-50 text-xs"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                      Delete
                    </Button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewResponses(form.id)}
                      className="w-full border-gray-300 text-gray-700 text-xs"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M21 6h-2l-1-2H6L5 6H3c-.55 0-1 .45-1 1s.45 1 1 1h1v11c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8h1c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                      </svg>
                      View Responses
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>


        )}
      </div>
    </div>
  );
};