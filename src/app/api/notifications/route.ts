// src/app/api/notifications/route.ts - Fixed auth import
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../lib/auth';
import { prisma } from '../../lib/prisma';

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread_only') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50');
        const page = parseInt(searchParams.get('page') || '1');
        const offset = (page - 1) * limit;

        const whereCondition = {
            user_id: user.id,
            ...(unreadOnly ? { read: false } : {}),
        };

        const [notifications, totalCount] = await Promise.all([
            prisma.notification.findMany({
                where: whereCondition,
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    type: true,
                    title: true,
                    message: true,
                    data: true,
                    read: true,
                    created_at: true,
                    updated_at: true,
                },
            }),
            prisma.notification.count({
                where: whereCondition,
            })
        ]);

        // Return array directly for backward compatibility
        return NextResponse.json(notifications);

    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

// PUT /api/notifications - Mark notification as read
export async function PUT(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const body = await request.json();
        const { notificationId, markAllAsRead } = body;

        if (markAllAsRead) {
            await prisma.notification.updateMany({
                where: {
                    user_id: user.id,
                    read: false
                },
                data: {
                    read: true
                },
            });

            return NextResponse.json({ message: 'All notifications marked as read' });
        }

        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        const notification = await prisma.notification.update({
            where: {
                id: notificationId,
                user_id: user.id,
            },
            data: {
                read: true
            },
        });

        return NextResponse.json({ notification });
    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json(
            { error: 'Failed to update notification' },
            { status: 500 }
        );
    }
}

// POST /api/notifications - Create new notification
export async function POST(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const body = await request.json();
        const { user_id, type, title, message, data } = body;

        if (user.role !== 'admin' && user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const notification = await prisma.notification.create({
            data: {
                user_id: user_id || user.id,
                type,
                title,
                message,
                data: data || null,
                read: false,
            },
        });

        return NextResponse.json({ notification }, { status: 201 });
    } catch (error) {
        console.error('Error creating notification:', error);
        return NextResponse.json(
            { error: 'Failed to create notification' },
            { status: 500 }
        );
    }
}

// DELETE /api/notifications - Delete notification
export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const { searchParams } = new URL(request.url);
        const notificationId = searchParams.get('id');

        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        await prisma.notification.delete({
            where: {
                id: parseInt(notificationId),
                user_id: user.id,
            },
        });

        return NextResponse.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return NextResponse.json(
            { error: 'Failed to delete notification' },
            { status: 500 }
        );
    }
}