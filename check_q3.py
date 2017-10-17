# reading file can start with either ERROR:\n or OUTPUT:\n
# if starts with ERROR:\n, then output first line after it
# can only print one line to the console which tells whether answer is correct or not

import sys

all_args = sys.argv
path_pieces = all_args[1:]

complete_path = ''

for piece in path_pieces:
	complete_path+=' '+piece

f = open(complete_path.strip(), 'r')
all_file = f.read()
f.close()

f = open("Inputs/q3_answer.txt", 'r')
answer = f.read(); answer = answer.strip(); answer = answer.lower();
f.close()

# actual marking starts here

is_correct = 0

all_lines = all_file.split("\n")

if all_lines[0].lower().find("error:")!=-1:
	is_correct = 0
elif all_file.lower().find(answer)!=-1:
		is_correct = 1

print is_correct