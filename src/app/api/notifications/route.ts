// src/app/api/notifications/route.ts - Fixed to match schema
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '../../lib/prisma';

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread_only') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50');
        const page = parseInt(searchParams.get('page') || '1');
        const offset = (page - 1) * limit;

        const whereCondition = {
            user_id: parseInt(session.user.id),
            ...(unreadOnly ? { read: false } : {}), // Fixed: use 'read' instead of 'is_read'
        };

        const notifications = await prisma.notification.findMany({
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
                read: true,        // Fixed: use 'read' instead of 'is_read'
                created_at: true,
                updated_at: true,
            },
        });

        const totalCount = await prisma.notification.count({
            where: whereCondition,
        });

        return NextResponse.json({
            notifications,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
            },
        });
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
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { notificationId, markAllAsRead } = body;

        if (markAllAsRead) {
            // Mark all notifications as read for the user
            await prisma.notification.updateMany({
                where: {
                    user_id: parseInt(session.user.id),
                    read: false     // Fixed: use 'read' instead of 'is_read'
                },
                data: {
                    read: true      // Fixed: use 'read' instead of 'is_read'
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

        // Mark specific notification as read
        const notification = await prisma.notification.update({
            where: {
                id: notificationId,
                user_id: parseInt(session.user.id), // Ensure user owns this notification
            },
            data: {
                read: true      // Fixed: use 'read' instead of 'is_read'
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

// POST /api/notifications - Create new notification (for admin/system use)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { user_id, type, title, message, data } = body;

        // Only allow admins to create notifications for other users
        if (session.user.role !== 'admin' && user_id !== parseInt(session.user.id)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const notification = await prisma.notification.create({
            data: {
                user_id: user_id || parseInt(session.user.id),
                type,
                title,
                message,
                data: data || null,
                read: false,    // Fixed: use 'read' instead of 'is_read'
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
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const notificationId = searchParams.get('id');

        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        // Delete notification (only if user owns it)
        await prisma.notification.delete({
            where: {
                id: parseInt(notificationId),
                user_id: parseInt(session.user.id), // Ensure user owns this notification
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