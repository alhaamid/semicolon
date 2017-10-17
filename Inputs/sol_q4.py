inpFile = open("q4.in")
noCases = int(inpFile.readline());
for i in xrange(noCases):
	x = inpFile.readline().split(',');
	noBulbs = int(x[0]);
	fingerSnaps = int(x[1]);
	if (fingerSnaps+1) % (2**noBulbs) == 0:
		print 'ON';
	else:
		print 'OFF';