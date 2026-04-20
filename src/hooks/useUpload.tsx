import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { collection, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';
import { playSound } from '../lib/sounds';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Using ImgBB as a free alternative to Firebase Storage
// Fallback key provided, but user should configure VITE_IMGBB_API_KEY in Secrets
const IMGBB_API_KEY = (import.meta as any).env.VITE_IMGBB_API_KEY || 'b696417730e79786314811831c1722d5';

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  type: 'post' | 'product' | 'profile' | 'message';
  data?: any;
}

interface UploadContextType {
  activeUploads: UploadTask[];
  startUpload: (file: File, type: 'post' | 'product' | 'profile' | 'message', data: any) => Promise<void>;
  removeUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);

  const removeUpload = useCallback((id: string) => {
    setActiveUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const startUpload = useCallback(async (file: File, type: 'post' | 'product' | 'profile' | 'message', data: any) => {
    const id = Math.random().toString(36).substring(7);
    const fileName = file.name;

    setActiveUploads(prev => [...prev, { id, fileName, progress: 0, status: 'uploading', type, data }]);

    // Use ImgBB for images to avoid Firebase Storage billing issues
    const isImage = file.type.startsWith('image/');
    
    if (!isImage) {
      try {
        const storagePath = type === 'message' ? `chats/${id}_${fileName}` : 
                           type === 'post' ? `posts/${id}_${fileName}` :
                           type === 'profile' ? `profiles/${data.uid}_${id}` :
                           `products/${data.productId}/${id}_${fileName}`;
        
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, progress } : u));
          }, 
          (error) => {
            console.error("Firebase Storage Error:", error);
            setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error' } : u));
            setTimeout(() => removeUpload(id), 10000);
          }, 
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              let firestoreSuccess = false;

              if (type === 'message') {
                const { createdAt, seen, ...restData } = data;
                const fieldName = file.type.startsWith('audio/') ? 'audioUrl' : 'videoUrl';
                await addDoc(collection(db, 'messages'), {
                  ...restData,
                  [fieldName]: downloadURL,
                  createdAt: serverTimestamp(),
                  seen: false
                });
                firestoreSuccess = true;
              }

              if (firestoreSuccess) {
                setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'completed', progress: 100 } : u));
                setTimeout(() => removeUpload(id), 5000);
              }
            } catch (e) {
              setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error' } : u));
            }
          }
        );
        return;
      } catch (err) {
        setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error' } : u));
        return;
      }
    }

    // Image Upload via ImgBB (Free, no billing required)
    try {
      // Check file size (ImgBB limit is 32MB, but we'll limit to 10MB for stability)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File is too large. Max size is 10MB.");
      }

      // Convert file to base64 for more reliable upload
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/xxx;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;
      const formData = new FormData();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', base64Image);

      const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, progress } : u));
        }
      });

      if (response.data?.data?.url) {
        const downloadURL = response.data.data.url;
        let firestoreSuccess = false;

        if (type === 'message') {
          const { createdAt, seen, ...restData } = data;
          try {
            await addDoc(collection(db, 'messages'), {
              ...restData,
              imageUrl: downloadURL,
              createdAt: serverTimestamp(),
              seen: false
            });
            playSound('message');
            firestoreSuccess = true;
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'messages');
          }
        } else if (type === 'post') {
          try {
            await addDoc(collection(db, 'posts'), {
              ...data,
              imageUrl: downloadURL,
              videoUrl: '',
              createdAt: serverTimestamp(),
            });
            playSound('post');
            firestoreSuccess = true;
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'posts');
          }
        } else if (type === 'profile') {
          try {
            await updateDoc(doc(db, 'users', data.uid), { photoURL: downloadURL });
            firestoreSuccess = true;
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${data.uid}`);
          }
        } else if (type === 'product') {
          try {
            await updateDoc(doc(db, 'products', data.productId), {
              images: arrayUnion(downloadURL)
            });
            firestoreSuccess = true;
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `products/${data.productId}`);
          }
        }

        if (firestoreSuccess) {
          setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'completed', progress: 100 } : u));
          setTimeout(() => removeUpload(id), 5000);
        }
      }
    } catch (err: any) {
      console.error("ImgBB Upload Error:", err);
      if (err.response) {
        console.error("ImgBB Error Response Data:", JSON.stringify(err.response.data));
        console.error("ImgBB Error Status:", err.response.status);
      }
      setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error' } : u));
      setTimeout(() => removeUpload(id), 10000);
    }
  }, [removeUpload]);

  return (
    <UploadContext.Provider value={{ activeUploads, startUpload, removeUpload }}>
      {children}
      
      {/* Global Upload Progress UI */}
      <div className="fixed bottom-24 left-8 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {activeUploads.map(upload => (
            <motion.div
              key={upload.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl shadow-2xl w-64 pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {upload.status === 'uploading' && <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />}
                  {upload.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {upload.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                  <span className="text-[10px] font-black text-slate-400 uppercase truncate max-w-[120px]">{upload.fileName}</span>
                </div>
                <span className="text-[10px] font-black text-purple-400">{Math.round(upload.progress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${upload.status === 'error' ? 'bg-red-500' : 'bg-purple-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${upload.progress}%` }}
                />
              </div>
              {upload.status === 'completed' && (
                <p className="text-[10px] font-bold text-green-500 mt-2">Upload complete! ✨</p>
              )}
              {upload.status === 'error' && (
                <p className="text-[10px] font-bold text-red-500 mt-2">Upload failed. Try again.</p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}
