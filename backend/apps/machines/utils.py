from datetime import datetime, time, date, timedelta
from django.utils import timezone
from .models import Factory

def get_current_production_date_and_shift(timestamp=None):
    if timestamp is None:
        timestamp = timezone.localtime(timezone.now())
    else:
        timestamp = timezone.localtime(timestamp)

    factory = Factory.objects.first()
    
    # Defaults
    shift_1_start = time(8, 0)
    shift_2_start = time(16, 0)
    shift_3_start = time(0, 0)
    shift_hours = 8
    
    if factory:
        shift_1_start = factory.shift_1_start or shift_1_start
        shift_2_start = factory.shift_2_start or shift_2_start
        shift_3_start = factory.shift_3_start or shift_3_start
        shift_hours = factory.shift_hours or 8

    t = timestamp.time()
    
    # Determine the production date
    # If time is between midnight and shift_1_start, it belongs to the previous day
    prod_date = timestamp.date()
    if t < shift_1_start:
        prod_date = prod_date - timedelta(days=1)
        
    s1_m = shift_1_start.hour * 60 + shift_1_start.minute
    s2_m = shift_2_start.hour * 60 + shift_2_start.minute
    s3_m = shift_3_start.hour * 60 + shift_3_start.minute
    t_m = t.hour * 60 + t.minute
    
    shift = 'I'
    if shift_hours == 12:
        if s1_m <= t_m < s2_m:
            shift = 'I'
        else:
            shift = 'II'
    else:
        if s1_m <= t_m < s2_m:
            shift = 'I'
        elif s2_m <= t_m < (s3_m if s3_m > s2_m else 1440):
            shift = 'II'
        else:
            shift = 'III'

    return prod_date, shift
