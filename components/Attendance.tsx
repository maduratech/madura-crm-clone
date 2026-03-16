import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataProvider';
import { supabase } from '../lib/supabase';
import { Staff, Activity } from '../types';

interface DailyAttendance {
    date: string;
    staff_id: number;
    staff_name: string;
    login_time: string | null;
    logout_time: string | null;
    login_count: number;
}

const Attendance: React.FC = () => {
    const { staff } = useData();
    const [attendanceData, setAttendanceData] = useState<DailyAttendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    
    useEffect(() => {
        const fetchAttendance = () => {
            if (!startDate || !endDate || staff.length === 0) return;
            setLoading(true);

            const staffMap = new Map<number, Staff>(staff.map(s => [s.id, s]));
            const dailyData: { [key: string]: DailyAttendance } = {};
            
            const dateRangeStart = new Date(startDate);
            const dateRangeEnd = new Date(endDate + 'T23:59:59');

            staff.forEach(staffMember => {
                (staffMember.activity_log || []).forEach((log: Activity) => {
                    const logDate = new Date(log.timestamp);
                    if (logDate < dateRangeStart || logDate > dateRangeEnd) return;
                    
                    if (log.type !== 'Login' && log.type !== 'Logout') return;

                    const date = logDate.toISOString().split('T')[0];
                    const key = `${date}-${staffMember.id}`;

                    if (!dailyData[key]) {
                        dailyData[key] = {
                            date,
                            staff_id: staffMember.id,
                            staff_name: staffMember.name,
                            login_time: null,
                            logout_time: null,
                            login_count: 0,
                        };
                    }

                    if (log.type === 'Login') {
                        dailyData[key].login_count++;
                        if (!dailyData[key].login_time || logDate < new Date(dailyData[key].login_time!)) {
                            dailyData[key].login_time = log.timestamp;
                        }
                    } else if (log.type === 'Logout') {
                        if (!dailyData[key].logout_time || logDate > new Date(dailyData[key].logout_time!)) {
                            dailyData[key].logout_time = log.timestamp;
                        }
                    }
                });
            });

            setAttendanceData(Object.values(dailyData).sort((a,b) => b.date.localeCompare(a.date) || a.staff_name.localeCompare(b.staff_name)));
            setLoading(false);
        };

        fetchAttendance();
    }, [startDate, endDate, staff]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Staff Attendance</h1>
                <div className="flex items-center gap-4">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md text-sm"/>
                    <span>to</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md text-sm"/>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                {loading ? (
                    <div className="text-center p-16">Loading attendance data...</div>
                ) : (
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Staff Member</th>
                                <th className="px-4 py-3">First Login</th>
                                <th className="px-4 py-3">Last Logout</th>
                                <th className="px-4 py-3 text-center">Total Logins</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {attendanceData.map((row, i) => (
                                <tr key={i} className="border-b hover:bg-slate-50">
                                    <td className="px-4 py-3">{row.date}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">{row.staff_name}</td>
                                    <td className="px-4 py-3">{row.login_time ? new Date(row.login_time).toLocaleTimeString() : 'N/A'}</td>
                                    <td className="px-4 py-3">{row.logout_time ? new Date(row.logout_time).toLocaleTimeString() : 'N/A'}</td>
                                    <td className="px-4 py-3 text-center">{row.login_count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && attendanceData.length === 0 && <div className="text-center p-16 text-slate-500">No attendance data for the selected date range.</div>}
            </div>
        </div>
    );
};

export default Attendance;