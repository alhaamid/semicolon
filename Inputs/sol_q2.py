digits = ""; lowerbound = ""

def give_minimum(_current, _index):
	# print _current
	if _index >= len(digits):
		return long(_current)
	else:
		# print _current, "calling"
		one = give_minimum(_current + digits[_index], _index+1)

		# print _current, "calling"
		two = give_minimum(digits[_index] + _current, _index+1)

		one_long = long(one); two_long = long(two)

		# print _current, "got", one_long, "&", two_long

		r_value = None
		if (one_long >= long(lowerbound[:_index+1]) and two_long >= long(lowerbound[:_index+1])):
			r_value = min([one_long, two_long])
		elif one_long >= long(lowerbound[:_index+1]):
			r_value = one_long
		elif two_long >= long(lowerbound[:_index+1]):
			r_value = two_long
		else:
			r_value = -1

		# print _current, ":returning:", r_value, "\n"
		return r_value

if __name__ == "__main__":
	f = open("q2.in", 'r'); all_file = f.read(); f.close();
	lines = all_file.split("\n")
	num_test_cases = long(lines[0])

	for i in xrange(1,num_test_cases+1):
		pieces = lines[i].split(",")
		digits = pieces[0]; lowerbound = pieces[1];
		print give_minimum(digits[0] , 1)