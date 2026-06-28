import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Course, DocumentItem, User } from '../types';
import { LMSCertificate } from '../lmsTypes';
import { lmsService } from '../lmsService';
import { StudentDashboard } from './lms/StudentDashboard';
import { InstructorDashboard } from './lms/InstructorDashboard';
import { CourseClassroom } from './lms/CourseClassroom';
import { CertificateView, triggerDirectCertificatePrint } from './lms/CertificateView';
import { 
  BookOpen, ShieldCheck, Award, Zap, Sparkles, RefreshCw, Navigation,
  Activity, GraduationCap, Compass, Briefcase, FileUp, ListChecks, HelpCircle, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AvaProps {
  courses: Course[];
  documents: DocumentItem[];
  currentUser: User;
  users: User[];
  onRefresh: () => void;
  viewMode?: 'student_dashboard' | 'classroom' | 'instructor_dashboard';
  setViewMode?: (mode: 'student_dashboard' | 'classroom' | 'instructor_dashboard') => void;
  activeCourse?: Course | null;
  setActiveCourse?: (course: Course | null) => void;
}

export const Ava: React.FC<AvaProps> = ({ 
  courses, documents, currentUser, users, onRefresh,
  viewMode: controlledViewMode,
  setViewMode: controlledSetViewMode,
  activeCourse: controlledActiveCourse,
  setActiveCourse: controlledSetActiveCourse
}) => {
  // Navigation states
  const [localViewMode, setLocalViewMode] = useState<'student_dashboard' | 'classroom' | 'instructor_dashboard'>('student_dashboard');
  const [localActiveCourse, setLocalActiveCourse] = useState<Course | null>(null);

  const viewMode = controlledViewMode !== undefined ? controlledViewMode : localViewMode;
  const setViewMode = controlledSetViewMode !== undefined ? controlledSetViewMode : setLocalViewMode;
  const activeCourse = controlledActiveCourse !== undefined ? controlledActiveCourse : localActiveCourse;
  const setActiveCourse = controlledSetActiveCourse !== undefined ? controlledSetActiveCourse : setLocalActiveCourse;
  
  // Floating certificate viewer overlay
  const [viewerCertificate, setViewerCertificate] = useState<LMSCertificate | null>(null);

  // Core authorization checks
  const isInstructor = currentUser && (
    currentUser.role === 'Coordenador' || 
    currentUser.role === 'Administrador' ||
    currentUser.id === 'user-sample-instructor' ||
    currentUser.name.includes('Melo') ||
    currentUser.name.includes('Deivid')
  );

  // Public authenticity parameter watcher (?verify=xxx-xxx)
  const [validatedCertificate, setValidatedCertificate] = useState<LMSCertificate | null>(null);
  const [isVerifyingUrlParam, setIsVerifyingUrlParam] = useState(false);

  useEffect(() => {
    checkUrlVerification();
  }, []);

  const checkUrlVerification = async () => {
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get('verify');
    if (verifyId) {
      setIsVerifyingUrlParam(true);
      try {
        const allCerts = await lmsService.fetchAllCertificates();
        const matched = allCerts.find(c => c.id === verifyId);
        if (matched) {
          setValidatedCertificate(matched);
        } else {
          // Check local fallbacks directly in case of asynchronous latency
          const cachedCertsString = localStorage.getItem('lms_db_certificates');
          if (cachedCertsString) {
            const parsed = JSON.parse(cachedCertsString) as LMSCertificate[];
            const matchedCache = parsed.find(c => c.id === verifyId);
            if (matchedCache) setValidatedCertificate(matchedCache);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsVerifyingUrlParam(false);
      }
    }
  };

  const clearUrlVerification = () => {
    setValidatedCertificate(null);
    // Clear url query from address bar silently
    const url = new URL(window.location.href);
    url.searchParams.delete('verify');
    window.history.replaceState({}, '', url.pathname + url.search);
  };

  return (
    <div className="bg-[#f8fafc] pb-16 lg:pb-2 lg:min-h-0 lg:h-full lg:max-h-full flex flex-col lg:overflow-hidden w-full">
      
      {/* 1. PUBLIC VALIDATION BANNER / MODAL */}
      <AnimatePresence>
        {(validatedCertificate || isVerifyingUrlParam) && createPortal(
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-md z-[9999] overflow-y-auto flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[3rem] p-6 md:p-10 max-w-4xl w-full border border-slate-100 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            >
              <button 
                onClick={clearUrlVerification}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X size={20} />
              </button>

              {isVerifyingUrlParam ? (
                <div className="py-12 text-center">
                  <RefreshCw className="animate-spin text-brand-blue mx-auto mb-3" size={32} />
                  <p className="text-xs font-black text-slate-450 uppercase tracking-widest">Validando Selo do Certificado...</p>
                </div>
              ) : validatedCertificate ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center text-center space-y-2 pb-6 border-b border-slate-50">
                    <div className="w-12 h-12 bg-green-100 text-brand-green rounded-full flex items-center justify-center shadow-inner">
                      <ShieldCheck size={26} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800">Certificado Autêntico Verificado</h3>
                    <p className="text-xs text-slate-500 font-semibold max-w-md">Esta credencial foi emitida pela Pascom EAD e está em conformidade com as diretrizes eclesiais vigentes.</p>
                  </div>

                  <CertificateView 
                    certificate={validatedCertificate} 
                    onClose={clearUrlVerification} 
                  />
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-xs font-bold text-red-500">Credencial com este ID de verificação não encontrada ou inválida.</p>
                </div>
              )}
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* 3. CORE SUBROUTING CONTAINER */}
      <div className={`px-3 md:px-6 lg:px-8 pt-2 pb-2 ${viewMode === 'student_dashboard' && !activeCourse ? 'w-full' : 'lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden'}`}>
        <AnimatePresence mode="wait">
          
          {/* A. STUDENT DASHBOARD */}
          {viewMode === 'student_dashboard' && !activeCourse && (
            <div
              key="view-student-dash"
              className="transition-opacity duration-300 animate-in fade-in"
            >
              <StudentDashboard
                courses={courses}
                currentUser={currentUser}
                users={users}
                onSelectCourse={(course) => {
                  setActiveCourse(course);
                  setViewMode('classroom');
                }}
                onViewCertificate={(cert) => triggerDirectCertificatePrint(cert)}
                onRefresh={onRefresh}
              />
            </div>
          )}

          {/* B. VIRTUAL HIGH FIDELITY CLASSROOM */}
          {viewMode === 'classroom' && activeCourse && (
            <div
              key="view-classroom-panel"
              className="transition-opacity duration-300 animate-in fade-in lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0"
            >
              <CourseClassroom
                course={activeCourse}
                currentUser={currentUser}
                onBack={() => {
                  setActiveCourse(null);
                  setViewMode('student_dashboard');
                }}
                onRefresh={onRefresh}
              />
            </div>
          )}

          {/* C. COORDINATORS AND INSTRUCTORS DASHBOARD */}
          {viewMode === 'instructor_dashboard' && isInstructor && (
            <div
              key="view-instructor-dash"
              className="transition-opacity duration-300 animate-in fade-in lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0 lg:overflow-hidden"
            >
              <InstructorDashboard
                courses={courses}
                users={users}
                onRefresh={onRefresh}
              />
            </div>
          )}

        </AnimatePresence>
      </div>

      {/* 4. OVERLAY DETAILED DIPLOMA VIEW CARD */}
      <AnimatePresence>
        {viewerCertificate && createPortal(
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[9999] overflow-y-auto flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[3.5rem] p-6 md:p-8 max-w-5xl w-full border border-slate-100 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            >
              <button 
                onClick={() => setViewerCertificate(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X size={20} />
              </button>

              <CertificateView 
                certificate={viewerCertificate} 
                onClose={() => setViewerCertificate(null)} 
              />
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

    </div>
  );
};
