// src/app/api/notifications/route.ts - In-app notifications
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread_only') === 'true';

        const where: any = { user_id: userId };
        if (unreadOnly) {
            where.is_read = false;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { created_at: 'desc' },
            take: 50 // Limit to 50 most recent
        });

        return NextResponse.json(notifications);

    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const body = await request.json();
        const { notification_id, mark_as_read } = body;

        if (notification_id) {
            // Mark specific notification as read
            await prisma.notification.update({
                where: {
                    id: notification_id,
                    user_id: userId
                },
                data: { is_read: true }
            });
        } else if (mark_as_read === 'all') {
            // Mark all as read
            await prisma.notification.updateMany({
                where: { user_id: userId },
                data: { is_read: true }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error updating notifications:', error);
        return NextResponse.json(
            { error: 'Failed to update notifications' },
            { status: 500 }
        );
    }
}
