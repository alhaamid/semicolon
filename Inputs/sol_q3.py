import sys, math

def saveTheUniverse(engines, queries):
	best = 0
	for e in engines:
		if e in queries:
			best = max(best, queries.index(e))
		else:
			return 0
	return 1 + saveTheUniverse(engines, queries[best:])

if __name__=="__main__":
	fpin=open("q3.in")

	cases = int(fpin.readline().strip())
	for case in range(1,cases+1):
		engines = []
		queries = []
		numEngines = int(fpin.readline().strip())
		for e in range(numEngines):
			engines.append(fpin.readline().strip())
		numQueries = int(fpin.readline().strip())
		for q in range(numQueries):
			queries.append(fpin.readline().strip())
		print (saveTheUniverse(engines, queries))