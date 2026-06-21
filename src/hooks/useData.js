// src/hooks/useData.js - Components లో use చేయండి
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';

export const saveBill = async (userId, billData) => {
  await addDoc(collection(db, `users/${userId}/bills`), billData);
};

export const updateBill = async (userId, billId, billData) => {
  await updateDoc(doc(db, `users/${userId}/bills`, billId), billData);
};

export const deleteBill = async (userId, billId) => {
  await deleteDoc(doc(db, `users/${userId}/bills`, billId));
};

export const saveBudget = async (userId, budgets) => {
  await setDoc(doc(db, `users/${userId}/budgets/budget`), budgets);
};
