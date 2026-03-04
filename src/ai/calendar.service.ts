import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import axios from 'axios';

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
  ) {}

  async createCalendarEvent(
    userId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    userTimezone?: string,
  ): Promise<any> {
    // Get user's calendar tokens
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.googleCalendarAccessToken) {
      throw new BadRequestException('Calendar not connected. Please grant calendar access first.');
    }

    // Check if token is expired
    if (user.googleCalendarTokenExpiry && new Date() > user.googleCalendarTokenExpiry) {
      // Refresh the token
      await this.refreshAccessToken(userId);
      // Reload user with new token
      const refreshedUser = await this.userModel.findById(userId);
      user.googleCalendarAccessToken = refreshedUser.googleCalendarAccessToken;
    }

    try {
      // Get the user's calendar timezone if not provided
      let timezone = userTimezone;
      
      if (!timezone) {
        const calendarResponse = await axios.get(
          'https://www.googleapis.com/calendar/v3/calendars/primary',
          {
            headers: {
              Authorization: `Bearer ${user.googleCalendarAccessToken}`,
            },
          },
        );
        timezone = calendarResponse.data.timeZone || 'UTC';
      }

      // Create event in Google Calendar using the specified timezone
      const event = {
        summary: title,
        description: description,
        start: {
          dateTime: startTime.toISOString().replace('Z', ''),
          timeZone: timezone,
        },
        end: {
          dateTime: endTime.toISOString().replace('Z', ''),
          timeZone: timezone,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 30 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        event,
        {
          headers: {
            Authorization: `Bearer ${user.googleCalendarAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error.response?.data || error.message);
      throw new BadRequestException('Failed to create calendar event');
    }
  }

  async deleteCalendarEvent(
    userId: string,
    eventId: string,
  ): Promise<any> {
    // Get user's calendar tokens
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.googleCalendarAccessToken) {
      throw new BadRequestException('Calendar not connected. Please grant calendar access first.');
    }

    // Check if token is expired
    if (user.googleCalendarTokenExpiry && new Date() > user.googleCalendarTokenExpiry) {
      // Refresh the token
      await this.refreshAccessToken(userId);
      // Reload user with new token
      const refreshedUser = await this.userModel.findById(userId);
      user.googleCalendarAccessToken = refreshedUser.googleCalendarAccessToken;
    }

    try {
      // Delete event from Google Calendar
      await axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${user.googleCalendarAccessToken}`,
          },
        },
      );

      return { success: true };
    } catch (error) {
      console.error('Error deleting calendar event:', error.response?.data || error.message);
      throw new BadRequestException('Failed to delete calendar event');
    }
  }

  async listCalendarEvents(
    userId: string,
    maxResults: number = 10,
  ): Promise<any> {
    // Get user's calendar tokens
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.googleCalendarAccessToken) {
      throw new BadRequestException('Calendar not connected. Please grant calendar access first.');
    }

    // Check if token is expired
    if (user.googleCalendarTokenExpiry && new Date() > user.googleCalendarTokenExpiry) {
      // Refresh the token
      await this.refreshAccessToken(userId);
      // Reload user with new token
      const refreshedUser = await this.userModel.findById(userId);
      user.googleCalendarAccessToken = refreshedUser.googleCalendarAccessToken;
    }

    try {
      // List upcoming events from Google Calendar
      const response = await axios.get(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          headers: {
            Authorization: `Bearer ${user.googleCalendarAccessToken}`,
          },
          params: {
            maxResults,
            orderBy: 'startTime',
            singleEvents: true,
            timeMin: new Date().toISOString(),
          },
        },
      );

      return response.data.items || [];
    } catch (error) {
      console.error('Error listing calendar events:', error.response?.data || error.message);
      throw new BadRequestException('Failed to list calendar events');
    }
  }

  private async refreshAccessToken(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    
    if (!user || !user.googleCalendarRefreshToken) {
      throw new BadRequestException('No refresh token available');
    }

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.configService.get('GOOGLE_CALENDAR_CLIENT_ID'),
        client_secret: this.configService.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
        refresh_token: user.googleCalendarRefreshToken,
        grant_type: 'refresh_token',
      });

      const { access_token, expires_in } = response.data;

      await this.userModel.findByIdAndUpdate(userId, {
        googleCalendarAccessToken: access_token,
        googleCalendarTokenExpiry: new Date(Date.now() + expires_in * 1000),
      });
    } catch (error) {
      console.error('Error refreshing access token:', error.response?.data || error.message);
      throw new BadRequestException('Failed to refresh calendar access');
    }
  }
}
