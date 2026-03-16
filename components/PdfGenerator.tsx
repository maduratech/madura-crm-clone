import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataProvider';
import WelcomePdfContent from './WelcomePdfContent';
import { Lead, Customer, Staff, UploadedFile, OtherDocDetails, Document } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    if (arr.length < 2) {
        throw new Error('Invalid data URL');
    }
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Could not parse MIME type from data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

export const PdfGenerator: React.FC = () => {
    const { leads, customers, staff } = useData();
    const { addToast } = useToast();
    const [leadToProcess, setLeadToProcess] = useState<Lead | null>(null);
    const processedLeadIds = useRef(new Set<number>());
    const pdfContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Find a lead that needs processing and hasn't been started yet
        const unprocessedLead = leads.find(l => l.needs_welcome_pdf_generation && !processedLeadIds.current.has(l.id));
        if (unprocessedLead && !leadToProcess) {
            processedLeadIds.current.add(unprocessedLead.id); // Mark as started to prevent re-triggering
            setLeadToProcess(unprocessedLead);
        }
    }, [leads, leadToProcess]);

    useEffect(() => {
        if (!leadToProcess || !pdfContainerRef.current) return;

        const generateAndUpload = async () => {
            console.log(`[PdfGenerator] Starting PDF generation for lead ${leadToProcess.id}`);
            const customer = customers.find(c => c.id === leadToProcess.customer_id);
            const primaryStaff = staff.find(s => s.id === leadToProcess.assigned_to?.[0]?.id);

            if (!customer || !primaryStaff) {
                console.error(`[PdfGenerator] Missing customer or staff for lead ${leadToProcess.id}. Aborting.`);
                await supabase.from('leads').update({ needs_welcome_pdf_generation: false }).eq('id', leadToProcess.id);
                setLeadToProcess(null);
                return;
            }

            try {
                const canvas = await html2canvas(pdfContainerRef.current!, { scale: 2, useCORS: true });
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);
                const pdfDataUri = pdf.output('datauristring');
                
                const base64Content = pdfDataUri;
                const pdfFile = dataURLtoFile(pdfDataUri, `WelcomeSummary_Lead_${leadToProcess.id}.pdf`);

                const newFile: UploadedFile = {
                    name: pdfFile.name,
                    type: pdfFile.type,
                    size: pdfFile.size,
                    content: base64Content,
                };
                
                const newDocDetails: OtherDocDetails = {
                    documentName: `Welcome Summary for Lead #${leadToProcess.id}`,
                    personName: `${customer.first_name} ${customer.last_name}`,
                    notes: `Automatically generated on ${new Date().toLocaleDateString()}`,
                    customerId: customer.id,
                };

                const newDoc: Document<OtherDocDetails> = {
                    id: Date.now(),
                    file: newFile,
                    details: newDocDetails,
                };

                const { data: currentCustomer, error: fetchError } = await supabase.from('customers').select('documents').eq('id', customer.id).single();
                if (fetchError) throw fetchError;

                const currentDocuments = currentCustomer?.documents || { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] };
                const newOtherDocuments = [...(currentDocuments.otherDocuments || []), newDoc];
                const updatedDocuments = { ...currentDocuments, otherDocuments: newOtherDocuments };
                
                const { error: customerUpdateError } = await supabase.from('customers').update({ documents: updatedDocuments }).eq('id', customer.id);
                if (customerUpdateError) throw customerUpdateError;

                const newActivity = { id: Date.now(), type: 'PDF Generated', description: 'Welcome summary PDF was automatically generated and saved.', user: 'System', timestamp: new Date().toISOString() };
                const { data: currentLead } = await supabase.from('leads').select('activity').eq('id', leadToProcess.id).single();
                const updatedActivity = [newActivity, ...(currentLead?.activity || [])];

                await supabase.from('leads').update({ needs_welcome_pdf_generation: false, activity: updatedActivity }).eq('id', leadToProcess.id);
                
                addToast(`Welcome PDF for lead #${leadToProcess.id} has been generated and saved.`, 'success');
                console.log(`[PdfGenerator] Successfully processed lead ${leadToProcess.id}`);

            } catch (error: any) {
                console.error(`[PdfGenerator] Failed to process lead ${leadToProcess.id}:`, error);
                addToast(`Failed to generate PDF for lead #${leadToProcess.id}.`, 'error');
                // Don't clear the flag on error, so it can be retried or handled manually.
            } finally {
                // Done with this lead, reset state to look for the next one.
                setLeadToProcess(null);
            }
        };

        const timer = setTimeout(generateAndUpload, 1000); // Delay to ensure DOM is ready
        return () => clearTimeout(timer);

    }, [leadToProcess, customers, staff, addToast]);

    if (!leadToProcess) return null;

    const customer = customers.find(c => c.id === leadToProcess.customer_id);
    const primaryStaff = staff.find(s => s.id === leadToProcess.assigned_to?.[0]?.id);

    // Render nothing if data is missing, the effect hook will handle cleanup
    if (!customer || !primaryStaff) return null;

    return (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
            <div ref={pdfContainerRef}>
                <WelcomePdfContent lead={leadToProcess} customer={customer} staff={primaryStaff} />
            </div>
        </div>
    );
};
