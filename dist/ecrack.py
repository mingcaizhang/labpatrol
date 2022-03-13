#!/usr/bin/env python
"""
Simple minded translation of ecrack.pl as attached (in pdf) to
`contour doc <http://contour.calix.local:8080/contour/perspective.req?projectId=215&docId=395240?`_ 

Hardest part was matcing perl to python date numbers...

subs > defs
$var > var


commnents mostly preserved as is

usage of original perl script ecrack.pl: The 'lost-password' utility program. ::

    perl ecrack.pl <hostname> <WeekDay> <Month> <Monthday> <time> <year>

    E.g,, bash$ perl ecrack.pl E5-520 Wed Jan 8 23:22:00 2014
       The password for debug users are: 76500576

Note that the input Sys name + time/date  is as shown on login prompt::
    E5-308 login:
    Calix distro IB-1.0.1 E5-308 Wed Sep 24 13:47:59 2014


You can use the line containing the system ID and date from the
Telnet banner as the arguments to the program. It will reveals the
default and debug user password, which will be good until midnight
of the current day.

The System Name: E5-308
The System Time: Wed Sep 24 13:05:04 2014
The password for calixsupport is: 28-76374 


"""

import time
import argparse


def LastDigitsFromMultiply(X,Multiplier):
    """
    This implements a portion of the 'forgotten password' algorithm
    that is used multiple times. The basic idea is that we multiply
    two values together and concatenate the last digits of the result
    onto the password string. 'Last' means the last two digits if
    there are two or more digits. For a one digit result, we just use
    that digit twice.
    """

    XTimesMultiplier = X * Multiplier
    sDigits = str(XTimesMultiplier)

    if len(sDigits) < 2 :
        sDigits += sDigits

    return sDigits[-2:]

def CharAtValueModLen(sSysId,Value):
    """
    This implements a portion of the 'forgotten password' algorithm
    that is used multiple times. This routine divides the value by the
    length of sSysId, uses the remainder of that calculation as the
    index into sSysId and returns the character at that position.

    :param str sSysId: System name
    :param int value:  
    :retursn str: a sinlge character.
    """

    Idx = (Value - 1) % len(sSysId) # modulo name lengh
    sSysId.replace(" ","#")  # convert spaces to pound char.
    return sSysId[Idx] # char selected by modulo


def CliDbgPwGen( sSysId, sSysTime):
    """
    CliDbgPwGen: Password building 'driver' routine.

    :param str sSysId: As reported at login prompt
    :param str sSysTime: As reported at login -  Wed Jan 8 23:22:00 2014

    This is the routine that applications call to compute a 'forgotten
    password'. The data it operates on is the E5's 'system ID' and the
    current date for the system. This results in a password that's
    good until midnight.
    """

    SysTime = time.strptime(sSysTime) 

    # and adjust some to match perl notion of time
    # note this also includes matching 2 ecrack.pl adjustments
    # my $DayOfYear = $SysTime->yday + 1;
    # my $DayOfWeek = $SysTime->_wday + 1;

    # DayOfWeek  = SysTime.tm_wday + 2

    #    DayOfWeek  = SysTime.tm_wday + 2
    #    DayOfYear  = SysTime.tm_yday + 0
    #    Month      = SysTime.tm_mon  - 1

    DayOfWeek  = (SysTime.tm_wday + 2)

    if DayOfWeek  == 8:
        DayOfWeek = 1

    DayOfYear  = SysTime.tm_yday + 0
    Month      = SysTime.tm_mon  - 1

    Year       = SysTime.tm_year - 1900

    print("dayWk {} tm_yday {}  month {} year {}".format(DayOfWeek,SysTime.tm_yday,Month,Year))


    X = 0 
    # for c in list(str( ( Year * SysTime.tm_yday * len(sSysId) ) + DayOfWeek)) : X += int(c)
    for c in list(str( ( Year * DayOfYear * len(sSysId) ) + DayOfWeek)) : X += int(c)
    
    return "{}{}{}{}{}".format(
        LastDigitsFromMultiply(X, SysTime.tm_mday), CharAtValueModLen(sSysId, SysTime.tm_yday),
        LastDigitsFromMultiply(X, Month),CharAtValueModLen(sSysId, DayOfWeek),
        LastDigitsFromMultiply(X, DayOfYear))

def ecrack(id,sSysTime="Now"):
    """
    Generates passwords

    :param str:  Host name to generate password 
    :param str sSystime: Assci tod, if == Now uses current system time
    :returns : generated password string
    """
    if sSysTime == "Now" :
        sSysTime =  time.asctime() 

    return CliDbgPwGen(id, sSysTime)

def ecrackTest():
    """
    Unit test for passord cracker.
    Generates test passwords for 3 sytem names and a fixed date.
    """

    Id3 = ["E5-308",   "28-76374"] # name/expected password
    Id5 = ["E5-520",   "28-76574"] 
    Id6 = ["E5-520",   "BAD-PASS"] # Check we are actually checking.
    Id7 = ["ABCDEFG",  "12A04D71"]
    Id9 = ["ABCDEFGHI","44F48D77"] 

    testId    = [Id3,Id5,Id6,Id7,Id9]
    sSysTime  =  "Wed Sep 24 13:47:59 2014"
    testError = 0

    print("test with time= {}\n".format(sSysTime))

    for id in testId :
        pswd = ecrack(id[0], sSysTime)
        if pswd == id[1]: 
            print ("{}  \t{}".format(id[0],pswd))
        elif  id[1] == "BAD-PASS":
            print ("{}  \t{}".format(id[0],pswd))
        else:
            print ("FAIL >>>>  {} gen password {}".format(id,pswd))
            testError += 1

    testId = [Id3,Id5]

    sSysTime =  time.asctime() 

    print("\nDefault IDs password dejour: {}\n".format(sSysTime))
    for id in testId :
        pswd = ecrack(id[0], sSysTime)
        print ("{}\t{}".format(id[0],pswd))

    if testError > 0:
        print("\nSelf test fail with {} errors\n".format(testError))
    else:
        print("\nSelf Test  pass\n")
        
if __name__ == '__main__': # only runs if launched as script, not imported from other scripts.
    
    # ecrackTest() # unit test

    parser = argparse.ArgumentParser(description='Dynamic password generator')

    parser.add_argument('hostId',  help='Host ID, "+" will generate passwords for common names')
    parser.add_argument('date',    help='Default today, expects format: Wed Sep 24 13:47:59 2014', nargs=argparse.REMAINDER)
                           
    crackArgs = parser.parse_args()

    if len (crackArgs.date) > 0: # if input is badly formatted the resulting error is clear
        sSysTime = ""
        for arg in crackArgs.date : sSysTime += "{} ".format(arg) # the .REMAINDER gets these as list so need to make a single string
        sSysTime = sSysTime.strip() # loose the last space.
    else:
        sSysTime =  time.asctime() 

    print("\n{}\n".format(sSysTime))

    testId = [crackArgs.hostId]

    if testId[0] == '+' :
        testId = ["E5-308","E5-520"]

    for id in testId :
        print ("{}\t{}\n".format(id, ecrack(id,sSysTime)))



"""

The System Name: E5-520

The System Time: Fri Dec 5 16:58:46 2014
The password for calixsupport is: 20-64036

The System Time: Sat Dec 6 16:58:46 2014
The password for calixsupport is: 50575E00 

The System Time: Sun Dec 7 16:58:46 2014
The password for calixsupport is: 33209E79

The System Time: Mon Dec 8 16:58:46 2014
The password for calixsupport is: 60020540

"""
