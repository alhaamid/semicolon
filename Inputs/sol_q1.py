def give_num_groups(arr):
	bitmap = []
	for i in range(len(arr)):
		arr[i] = int(arr[i])
		bitmap.append(0)
	
	num_groups = 0

	for i in range(len(arr)):
		ptr_value = arr[i]
		if (bitmap[i])==0:
			bitmap[i] = 1

			rest = ptr_value-1

			if rest>0:
				for j in range(len(arr)):
					if rest==0:
						break

					if arr[j]==ptr_value and bitmap[j]==0:
						bitmap[j] = 1
						rest-=1
				
				if rest!=0:
					return -1
				else:
					num_groups+=1
			else:
				num_groups+=1
	return num_groups

if __name__ == "__main__":
	f = open("q1.in", 'r'); all_file = f.read(); f.close();
	lines = all_file.split("\n")

	num_test_cases = int(lines[0])
	for i in xrange(1,num_test_cases+1):
		arr = lines[i].split(",")
		print give_num_groups(arr)